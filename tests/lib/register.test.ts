import {
  calculateDenominationTotal,
  createEmptyDenominationSnapshot,
  DEFAULT_ARGENTINA_DENOMINATIONS,
  getCashMovementLabel,
  getCashMovementSignedAmount,
  isOpenCashSessionStatus,
  normalizeDenominationSnapshot
} from '@/lib/register';
import { sanitizeCashDenominations } from '@/lib/shop-settings';

describe('register', () => {
  it('creates an empty denomination snapshot with all values initialized to zero', () => {
    const snapshot = createEmptyDenominationSnapshot();

    expect(snapshot['20000.00']).toBe(0);
    expect(snapshot['10000.00']).toBe(0);
    expect(snapshot['10.00']).toBe(0);
    expect(Object.values(snapshot).every((value) => value === 0)).toBe(true);
  });

  it('normalizes mixed denomination input safely', () => {
    const snapshot = normalizeDenominationSnapshot({
      '20000.00': 1,
      '10000.00': '2',
      '1000.00': 3.9,
      '50.00': -5,
      '10.00': 'bad'
    });

    expect(snapshot['20000.00']).toBe(1);
    expect(snapshot['10000.00']).toBe(2);
    expect(snapshot['1000.00']).toBe(3);
    expect(snapshot['50.00']).toBe(0);
    expect(snapshot['10.00']).toBe(0);
  });

  it('calculates denomination totals using registered values', () => {
    const total = calculateDenominationTotal({
      ...createEmptyDenominationSnapshot(),
      '20000.00': 1,
      '10000.00': 2,
      '1000.00': 3,
      '50.00': 4
    });

    expect(total).toBe(43200);
  });

  it('calculates totals with custom denominations list', () => {
    const customList = [
      { value: 50000, label: 'Billete de $50.000' },
      { value: 20000, label: 'Billete de $20.000' }
    ];
    const total = calculateDenominationTotal(
      {
        '50000.00': 2,
        '20000.00': 3
      },
      customList
    );

    expect(total).toBe(160000);
  });

  it('returns movement labels and signed amounts consistently', () => {
    expect(getCashMovementLabel('CASH_DROP')).toBe('Cash drop');
    expect(getCashMovementLabel('PETTY_CASH')).toBe('Petty cash');
    expect(getCashMovementLabel('MANUAL_CORRECTION')).toBe('Manual correction');
    expect(getCashMovementLabel('PAYOUT')).toBe('Payout');

    expect(getCashMovementSignedAmount('MANUAL_CORRECTION', 50)).toBe(50);
    expect(getCashMovementSignedAmount('PAYOUT', 50)).toBe(-50);
  });

  it('identifies open sessions correctly', () => {
    expect(isOpenCashSessionStatus('OPEN')).toBe(true);
    expect(isOpenCashSessionStatus('CLOSED')).toBe(false);
    expect(isOpenCashSessionStatus('RECONCILED')).toBe(false);
  });

  describe('sanitizeCashDenominations', () => {
    it('returns default Argentina denominations when input is null, undefined, or not an array', () => {
      expect(sanitizeCashDenominations(null)).toEqual(DEFAULT_ARGENTINA_DENOMINATIONS);
      expect(sanitizeCashDenominations(undefined)).toEqual(DEFAULT_ARGENTINA_DENOMINATIONS);
      expect(sanitizeCashDenominations('invalid')).toEqual(DEFAULT_ARGENTINA_DENOMINATIONS);
      expect(sanitizeCashDenominations([])).toEqual(DEFAULT_ARGENTINA_DENOMINATIONS);
    });

    it('sanitizes, deduplicates, and sorts custom denominations descending', () => {
      const result = sanitizeCashDenominations([
        { value: 1000, label: 'Mil pesos' },
        { value: 50000, label: 'Cincuenta mil' },
        { value: 1000, label: 'Duplicado' },
        { value: -50, label: 'Negativo' },
        { value: 'not-a-number', label: 'Invalido' }
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ value: 50000, label: 'Cincuenta mil' });
      expect(result[1]).toEqual({ value: 1000, label: 'Mil pesos' });
    });

    it('generates auto-label when label is omitted or empty', () => {
      const result = sanitizeCashDenominations([
        { value: 50000 },
        { value: 5, label: '' }
      ]);

      expect(result[0].value).toBe(50000);
      expect(result[0].label).toContain('50.000');
      expect(result[1].value).toBe(5);
      expect(result[1].label).toContain('5');
    });
  });
});
