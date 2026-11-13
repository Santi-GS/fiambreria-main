'use client';

import type { Dispatch, SetStateAction } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { ProductFormData, VariantDraft } from './types';

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

export default function ProductVariantsTab({
  variants,
  setForm,
  toVariantLabel
}: {
  variants: VariantDraft[];
  setForm: Dispatch<SetStateAction<ProductFormData>>;
  toVariantLabel: (variant: VariantDraft) => string;
}) {
  function updateVariantField<K extends keyof VariantDraft>(
    index: number,
    field: K,
    value: VariantDraft[K]
  ) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      )
    }));
  }

  return (
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
        {variants.length ? (
          variants.map((variant, index) => (
            <div
              key={`variant-${index}`}
              className="space-y-3 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <Input
                  placeholder="Color (ej: Rojo)"
                  value={variant.color}
                  onChange={(event) => updateVariantField(index, 'color', event.target.value)}
                />
                <Input
                  placeholder="Talle / Tamaño (ej: Grande)"
                  value={variant.size}
                  onChange={(event) => updateVariantField(index, 'size', event.target.value)}
                />
                <Input
                  placeholder="Sabor (ej: Ahumado)"
                  value={variant.flavor}
                  onChange={(event) => updateVariantField(index, 'flavor', event.target.value)}
                />
                <Input
                  placeholder="Modelo (ej: Premium)"
                  value={variant.model}
                  onChange={(event) => updateVariantField(index, 'model', event.target.value)}
                />
                <Input
                  placeholder="SKU de variante"
                  value={variant.sku}
                  onChange={(event) => updateVariantField(index, 'sku', event.target.value)}
                />
                <Input
                  placeholder="Código de barras"
                  value={variant.barcode}
                  onChange={(event) => updateVariantField(index, 'barcode', event.target.value)}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Precio específico"
                  value={variant.priceOverride}
                  onChange={(event) =>
                    updateVariantField(index, 'priceOverride', event.target.value)
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Costo específico"
                  value={variant.costOverride}
                  onChange={(event) =>
                    updateVariantField(index, 'costOverride', event.target.value)
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700">
                  <input
                    type="checkbox"
                    checked={variant.isActive}
                    onChange={(event) =>
                      updateVariantField(index, 'isActive', event.target.checked)
                    }
                  />
                  Variante activa
                </label>

                <div className="text-xs font-medium text-stone-500">
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
  );
}
