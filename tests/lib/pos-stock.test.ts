import { describe, expect, it } from 'vitest';
import {
  evaluateWeightAgainstStock,
  getAvailableWeightedStockGrams,
  getBaseOptionId,
  getReservedDbUnitsForProduct
} from '@/lib/pos-stock';

describe('pos-stock helpers', () => {
  it('extracts base option id from synthetic weighted cart item ids', () => {
    expect(getBaseOptionId('prod-123-w-1730000000123')).toBe('prod-123');
    expect(getBaseOptionId('var-456-w-1730000000123-0')).toBe('var-456');
    expect(getBaseOptionId('prod-123')).toBe('prod-123');
  });

  it('calculates reserved grams across multiple weighted lines of the same product', () => {
    const cart = [
      { id: 'p1-w-1', productId: 'p1', qty: 0.35 },
      { id: 'p1-w-2', productId: 'p1', qty: 0.25 },
      { id: 'p2', productId: 'p2', qty: 2 }
    ];

    expect(getReservedDbUnitsForProduct(cart, 'p1', true)).toBe(600);
    // Excluding line 1 when editing line 1 leaves only line 2's 250g reserved
    expect(getReservedDbUnitsForProduct(cart, 'p1', true, 'p1-w-1')).toBe(250);
  });

  it('computes available stock in grams when adding vs editing a weighted cart item', () => {
    const cart = [
      { id: 'cheese-w-1', productId: 'cheese', qty: 0.6 },
      { id: 'cheese-w-2', productId: 'cheese', qty: 0.3 }
    ];

    // Total stock = 1000g (1.000 Kg). Adding a 3rd line: only 100g left.
    expect(getAvailableWeightedStockGrams(1000, cart, 'cheese')).toEqual({
      availableGrams: 100,
      reservedGrams: 900
    });

    // Editing line 1 (600g): line 2 holds 300g, so line 1 can be edited up to 700g.
    expect(getAvailableWeightedStockGrams(1000, cart, 'cheese', 'cheese-w-1')).toEqual({
      availableGrams: 700,
      reservedGrams: 300
    });
  });

  it('flags weights exceeding available stock and out-of-stock states accurately', () => {
    // Out of stock
    expect(evaluateWeightAgainstStock(250, 0)).toEqual({
      safeAvailableGrams: 0,
      normalizedGrams: 250,
      isOutOfStock: true,
      exceedsStock: false,
      isValidWeight: false,
      maxAllowedKg: 0
    });

    // Exceeds available stock (trying 500g when 450g available)
    expect(evaluateWeightAgainstStock(500, 450)).toEqual({
      safeAvailableGrams: 450,
      normalizedGrams: 500,
      isOutOfStock: false,
      exceedsStock: true,
      isValidWeight: false,
      maxAllowedKg: 0.45
    });

    // Exact available stock (450g when 450g available) is valid
    expect(evaluateWeightAgainstStock(450, 450)).toEqual({
      safeAvailableGrams: 450,
      normalizedGrams: 450,
      isOutOfStock: false,
      exceedsStock: false,
      isValidWeight: true,
      maxAllowedKg: 0.45
    });
  });
});

