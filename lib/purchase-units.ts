/**
 * Purchase unit math for products.
 *
 * Stock (`Product.stockQty`) is stored in the product's "stock unit":
 * - Weighable products (base unit `KG`): GRAMS.
 * - Everything else: units of the base unit.
 *
 * `ProductUomConversion.ratioToBase` is expressed in the product's *base unit*
 * (kg for weighable products, base units otherwise). Purchases need the ratio in
 * the *stock unit*, so for weighable products it is multiplied by 1000.
 */

export const GRAMS_PER_KG = 1000;

type UnitLike = { id?: string; code?: string | null; name?: string | null } | null | undefined;

type ProductUnitSource = {
  baseUnitOfMeasureId: string | null;
  baseUnitOfMeasure?: UnitLike;
  uomConversions: Array<{ unitOfMeasureId: string; ratioToBase: number }>;
};

export function isKgBaseProduct(product: Pick<ProductUnitSource, 'baseUnitOfMeasure'>) {
  return product.baseUnitOfMeasure?.code?.toUpperCase() === 'KG';
}

/** Stock units (grams for weighable products) contained in ONE purchase unit, or null if no conversion exists. */
export function getPurchaseRatioToStock(product: ProductUnitSource, unitOfMeasureId: string): number | null {
  const stockFactor = isKgBaseProduct(product) ? GRAMS_PER_KG : 1;

  if (product.baseUnitOfMeasureId === unitOfMeasureId) {
    return stockFactor;
  }

  const conversion = product.uomConversions.find((entry) => entry.unitOfMeasureId === unitOfMeasureId);
  if (!conversion || !(conversion.ratioToBase > 0)) {
    return null;
  }

  return Math.max(1, Math.round(conversion.ratioToBase * stockFactor));
}

/** Cost per sale unit (per kg for weighable products) from the cost of one purchase unit. */
export function getCostPerSaleUnit(unitCost: number, ratioToStock: number, isKgBase: boolean) {
  const saleUnitsPerPurchaseUnit = ratioToStock / (isKgBase ? GRAMS_PER_KG : 1);
  return saleUnitsPerPurchaseUnit > 0 ? unitCost / saleUnitsPerPurchaseUnit : unitCost;
}

/** Human readable stock, e.g. 4000 -> "4 kg" for weighable products. */
export function formatStock(stockQty: number, isKgBase: boolean, baseUnitName?: string | null) {
  if (isKgBase) {
    const kg = stockQty / GRAMS_PER_KG;
    return `${Number(kg.toFixed(3)).toLocaleString('es-MX')} kg`;
  }
  return `${stockQty.toLocaleString('es-MX')} ${baseUnitName?.toLowerCase() ?? 'unidades'}`;
}

