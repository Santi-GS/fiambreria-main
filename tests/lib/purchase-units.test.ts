import { describe, expect, it } from 'vitest';
import { formatStock, getCostPerSaleUnit, getPurchaseRatioToStock } from '@/lib/purchase-units';

const kgProduct = {
  baseUnitOfMeasureId: 'kg',
  baseUnitOfMeasure: { code: 'KG' },
  // 1 pieza sellada = 4 kg
  uomConversions: [{ unitOfMeasureId: 'piece', ratioToBase: 4 }]
};

const pieceProduct = {
  baseUnitOfMeasureId: 'piece',
  baseUnitOfMeasure: { code: 'PIECE' },
  uomConversions: [{ unitOfMeasureId: 'kg', ratioToBase: 5 }]
};

describe('getPurchaseRatioToStock', () => {
  it('buying a 4 kg sealed piece of a weighable product adds 4000 g', () => {
    expect(getPurchaseRatioToStock(kgProduct, 'piece')).toBe(4000);
  });

  it('buying by kilo adds 1000 g per kg', () => {
    expect(getPurchaseRatioToStock(kgProduct, 'kg')).toBe(1000);
  });

  it('leaves non-weighable products untouched', () => {
    expect(getPurchaseRatioToStock(pieceProduct, 'piece')).toBe(1);
    expect(getPurchaseRatioToStock(pieceProduct, 'kg')).toBe(5);
  });

  it('returns null when no conversion exists', () => {
    expect(getPurchaseRatioToStock(kgProduct, 'box')).toBeNull();
  });
});

describe('getCostPerSaleUnit', () => {
  it('derives the per-kg cost from a 4 kg piece', () => {
    expect(getCostPerSaleUnit(400, 4000, true)).toBe(100);
  });

  it('derives the per-piece cost for non weighable products', () => {
    expect(getCostPerSaleUnit(50, 5, false)).toBe(10);
  });
});

describe('formatStock', () => {
  it('shows grams as kg for weighable products', () => {
    expect(formatStock(4000, true)).toMatch(/^4 kg$/);
  });
});

