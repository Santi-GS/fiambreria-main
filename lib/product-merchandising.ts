type VariantShape = {
  color?: string | null;
  size?: string | null;
  flavor?: string | null;
  model?: string | null;
};

export function buildVariantLabel(variant: VariantShape) {
  const parts = [variant.color, variant.size, variant.flavor, variant.model]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];

  return parts.join(' / ');
}

export function getVariantDisplayName(productName: string, variant: VariantShape) {
  const label = buildVariantLabel(variant);
  return label ? `${productName} - ${label}` : productName;
}

export function getMarginSummary(price: number, cost: number) {
  if (price <= 0) {
    return {
      percentage: 0,
      tone: 'red' as const,
      message: 'El precio debe ser mayor a cero para calcular el margen.'
    };
  }

  const percentage = ((price - cost) / price) * 100;

  if (price <= cost) {
    return {
      percentage,
      tone: 'red' as const,
      message: 'El precio es igual o inferior al costo.'
    };
  }

  if (percentage < 15) {
    return {
      percentage,
      tone: 'amber' as const,
      message: 'El margen es muy ajustado.'
    };
  }

  return {
    percentage,
    tone: 'emerald' as const,
    message: 'El margen es saludable.'
  };
}
