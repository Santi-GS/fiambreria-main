import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';
import { roundCurrency } from '@/lib/inventory';
import { DEFAULT_ARGENTINA_DENOMINATIONS, type RegisterDenominationItem } from '@/lib/register';

export const TAX_MODE_OPTIONS = ['EXCLUSIVE', 'INCLUSIVE', 'NON_TAXABLE'] as const;
export const PRINTER_CONNECTION_OPTIONS = ['USB', 'NETWORK', 'BLUETOOTH', 'MANUAL'] as const;
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card'];
export const DEFAULT_TIMEZONE = 'Asia/Manila';
export const DEFAULT_OFFLINE_STOCK_MAX_AGE_MINUTES = 240;
export const DEFAULT_REORDER_SAFETY_STOCK = 3;

export type TaxModeValue = (typeof TAX_MODE_OPTIONS)[number];
export type PrinterConnectionValue = (typeof PRINTER_CONNECTION_OPTIONS)[number];

export function sanitizeCashDenominations(value: unknown): RegisterDenominationItem[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_ARGENTINA_DENOMINATIONS];
  }

  const seenValues = new Set<number>();
  const parsed: RegisterDenominationItem[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const rawVal = (entry as Record<string, unknown>).value;
    const rawLabel = (entry as Record<string, unknown>).label;
    const num = Number(rawVal);

    if (!Number.isFinite(num) || num <= 0) continue;
    const roundedValue = Math.round(num * 100) / 100;
    if (seenValues.has(roundedValue)) continue;
    seenValues.add(roundedValue);

    const label =
      typeof rawLabel === 'string' && rawLabel.trim()
        ? rawLabel.trim()
        : roundedValue >= 10
        ? `Billete de $${roundedValue.toLocaleString('es-AR')}`
        : `Moneda de $${roundedValue.toLocaleString('es-AR')}`;

    parsed.push({ value: roundedValue, label });
  }

  if (parsed.length === 0) {
    return [...DEFAULT_ARGENTINA_DENOMINATIONS];
  }

  return parsed.sort((a, b) => b.value - a.value);
}

export function sanitizeOfflineStockMaxAgeMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_OFFLINE_STOCK_MAX_AGE_MINUTES;
  }

  return Math.min(Math.max(Math.round(parsed), 5), 1440);
}

export function sanitizeReorderSafetyStock(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REORDER_SAFETY_STOCK;
  }

  return Math.min(Math.max(Math.round(parsed), 0), 365);
}

export function sanitizeDefaultPaymentMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_PAYMENT_METHODS;
  }

  const methods = value.filter((entry): entry is PaymentMethod =>
    typeof entry === 'string' && PAYMENT_METHODS.includes(entry as PaymentMethod)
  );

  return [...new Set(methods)].length ? [...new Set(methods)] : DEFAULT_PAYMENT_METHODS;
}

export function getTaxModeLabel(value: TaxModeValue | string) {
  switch (value) {
    case 'INCLUSIVE':
      return 'Impuesto incluido';
    case 'NON_TAXABLE':
      return 'No gravable';
    default:
      return 'Impuesto no incluido';
  }
}

export function getPrinterConnectionLabel(value: PrinterConnectionValue | string) {
  switch (value) {
    case 'NETWORK':
      return 'Impresora de red';
    case 'BLUETOOTH':
      return 'Impresora Bluetooth';
    case 'MANUAL':
      return 'Manual / impresión del navegador';
    default:
      return 'Impresora USB';
  }
}

export function calculateTaxBreakdown({
  subtotal,
  discountAmount,
  taxRate,
  taxMode
}: {
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxMode: TaxModeValue | string;
}) {
  const roundedSubtotal = roundCurrency(subtotal);
  const roundedDiscount = roundCurrency(discountAmount);
  const taxableSubtotal = roundCurrency(Math.max(roundedSubtotal - roundedDiscount, 0));

  if (taxMode === 'NON_TAXABLE') {
    return {
      subtotal: roundedSubtotal,
      taxAmount: 0,
      totalAmount: taxableSubtotal
    };
  }

  if (taxMode === 'INCLUSIVE') {
    const divisor = 1 + taxRate / 100;
    const taxAmount = taxRate > 0 ? roundCurrency(taxableSubtotal - taxableSubtotal / divisor) : 0;
    return {
      subtotal: roundedSubtotal,
      taxAmount,
      totalAmount: taxableSubtotal
    };
  }

  const taxAmount = roundCurrency(roundedSubtotal * (taxRate / 100));
  return {
    subtotal: roundedSubtotal,
    taxAmount,
    totalAmount: roundCurrency(roundedSubtotal + taxAmount - roundedDiscount)
  };
}
