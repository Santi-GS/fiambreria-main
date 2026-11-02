import { describe, expect, it } from 'vitest';
import {
  COMMON_BANKNOTE_DENOMINATIONS,
  getPaymentMethodLabel,
  getPaymentSummary,
  getQuickCashAmounts,
  normalizePaymentInput,
  requiresReferenceNumber,
  validatePaymentsForSale
} from '@/lib/payments';

describe('payments', () => {
  it('translates payment method labels to Spanish', () => {
    expect(getPaymentMethodLabel('Cash')).toBe('Efectivo');
    expect(getPaymentMethodLabel('Card')).toBe('Tarjeta');
    expect(getPaymentMethodLabel('E-Wallet')).toBe('Billetera virtual');
    expect(getPaymentMethodLabel('Bank Transfer')).toBe('Transferencia bancaria');
    expect(getPaymentMethodLabel('Split')).toBe('Pago dividido');
    expect(getPaymentMethodLabel('Customer Credit')).toBe('Cuenta corriente (Crédito)');
  });

  it('requires references for card, e-wallet, and bank transfer payments', () => {
    expect(requiresReferenceNumber('Cash')).toBe(false);
    expect(requiresReferenceNumber('Card')).toBe(true);
    expect(requiresReferenceNumber('E-Wallet')).toBe(true);
    expect(requiresReferenceNumber('Bank Transfer')).toBe(true);
  });

  it('normalizes payment input amounts and empty references', () => {
    expect(
      normalizePaymentInput({
        method: 'Cash',
        amount: 100.456,
        referenceNumber: '   '
      })
    ).toEqual({
      method: 'Cash',
      amount: 100.46,
      referenceNumber: null
    });
  });

  it('rejects missing bank transfer references', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Bank Transfer', amount: 500, referenceNumber: null }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Los pagos con transferencia bancaria requieren un número de referencia.');
    }
  });

  it('rejects duplicate non-cash references for the same payment method', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Card', amount: 250, referenceNumber: 'ABC123' },
      { method: 'Card', amount: 250, referenceNumber: 'abc123' }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        'No se permiten números de referencia duplicados para tarjeta en una misma venta.'
      );
    }
  });

  it('allows cash overpayment while returning change', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Cash', amount: 1000, referenceNumber: null }
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.changeDue).toBe(500);
      expect(result.summary.totalPaid).toBe(1000);
    }
  });

  it('blocks non-cash overpayment', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Card', amount: 600, referenceNumber: 'CARD-1' }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        'Los pagos que no sean en efectivo deben coincidir exactamente con el total de la venta.'
      );
    }
  });

  it('summarizes mixed cash and non-cash tenders correctly', () => {
    const summary = getPaymentSummary(500, [
      { method: 'Cash', amount: 300, referenceNumber: null },
      { method: 'Card', amount: 200, referenceNumber: 'CARD-2' }
    ]);

    expect(summary).toEqual({
      totalPaid: 500,
      remainingAmount: 0,
      changeDue: 0,
      cashReceived: 300,
      hasCashPayment: true
    });
  });

  it('includes common banknote denominations ($10,000 and $20,000) in quick cash amounts', () => {
    expect(COMMON_BANKNOTE_DENOMINATIONS).toEqual([10000, 20000]);

    // Small amount includes 10000 and 20000
    const amountsForSmallDue = getQuickCashAmounts(3500);
    expect(amountsForSmallDue).toContain(10000);
    expect(amountsForSmallDue).toContain(20000);
    expect(amountsForSmallDue[0]).toBe(3500);

    // Medium amount includes 20000
    const amountsForMediumDue = getQuickCashAmounts(12000);
    expect(amountsForMediumDue).toContain(20000);
  });
});
