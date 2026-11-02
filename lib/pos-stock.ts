export type CartStockLine = {
  id: string;
  productId: string;
  qty: number;
};

export const MAX_SINGLE_WEIGH_GRAMS = 99_999;

/**
 * Extracts the base catalog option ID (productId or variantId)
 * from a synthetic weighted cart line ID (`<optionId>-w-<timestamp>`).
 */
export function getBaseOptionId(cartItemId: string): string {
  const markerIndex = cartItemId.indexOf('-w-');
  return markerIndex >= 0 ? cartItemId.slice(0, markerIndex) : cartItemId;
}

/**
 * Calculates reserved inventory units in the database's native storage scale:
 * - Weighted products (`isWeighted = true`, base unit `KG`): grams (`Math.round(qty * 1000)`).
 * - Standard unit products (`isWeighted = false`): integer units (`qty`).
 *
 * When editing an existing cart line, pass `exceptCartItemId` so that line's
 * current quantity is excluded from the reserved count.
 */
export function getReservedDbUnitsForProduct(
  cart: CartStockLine[],
  productId: string,
  isWeighted: boolean,
  exceptCartItemId?: string
): number {
  return cart.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (exceptCartItemId && item.id === exceptCartItemId) return sum;
    return sum + (isWeighted ? Math.round(item.qty * 1000) : item.qty);
  }, 0);
}

/**
 * Computes available and reserved stock in grams for a weighable (`KG`) product.
 */
export function getAvailableWeightedStockGrams(
  productStockGrams: number,
  cart: CartStockLine[],
  productId: string,
  exceptCartItemId?: string
): { availableGrams: number; reservedGrams: number } {
  const reservedGrams = Math.max(
    0,
    getReservedDbUnitsForProduct(cart, productId, true, exceptCartItemId)
  );
  const availableGrams = Math.max(0, Math.round(productStockGrams) - reservedGrams);

  return { availableGrams, reservedGrams };
}

/**
 * Evaluates a candidate weight (in grams) against the product's available stock in grams.
 */
export function evaluateWeightAgainstStock(
  weightGrams: number,
  availableStockGrams: number
): {
  safeAvailableGrams: number;
  normalizedGrams: number;
  isOutOfStock: boolean;
  exceedsStock: boolean;
  isValidWeight: boolean;
  maxAllowedKg: number;
} {
  const safeAvailableGrams = Math.max(0, Math.round(availableStockGrams));
  const normalizedGrams = Math.max(0, Math.round(weightGrams));
  const isOutOfStock = safeAvailableGrams <= 0;
  const exceedsStock = !isOutOfStock && normalizedGrams > safeAvailableGrams;
  const isValidWeight =
    normalizedGrams > 0 &&
    normalizedGrams <= MAX_SINGLE_WEIGH_GRAMS &&
    !isOutOfStock &&
    !exceedsStock;

  return {
    safeAvailableGrams,
    normalizedGrams,
    isOutOfStock,
    exceedsStock,
    isValidWeight,
    maxAllowedKg: safeAvailableGrams / 1000
  };
}

