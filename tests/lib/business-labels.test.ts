import {
  getAdjustmentTypeLabel,
  getInventoryMovementTypeLabel,
  getRegisterSessionStatusLabel,
  getSaleStatusLabel,
  getStockCountStatusLabel,
  humanizeEnumLabel
} from '../../lib/business-labels';

describe('lib/business-labels', () => {
  it('humanizes unknown enum-like values', () => {
    expect(humanizeEnumLabel('CUSTOM_MIXED_CASE')).toBe('Custom Mixed Case');
    expect(humanizeEnumLabel(null)).toBe('N/D');
  });

  it('returns explicit business labels for key sale and adjustment states', () => {
    expect(getSaleStatusLabel('COMPLETED')).toBe('Completada');
    expect(getAdjustmentTypeLabel('VOID')).toBe('Anulación');
    expect(getRegisterSessionStatusLabel('OPEN')).toBe('Caja abierta');
    expect(getStockCountStatusLabel('IN_PROGRESS')).toBe('Conteo en curso');
  });

  it('returns inventory movement labels for operational history', () => {
    expect(getInventoryMovementTypeLabel('PURCHASE_RECEIVED')).toBe('Compra recibida');
    expect(getInventoryMovementTypeLabel('TRANSFER_IN')).toBe('Transferencia de sucursal recibida');
  });
});
