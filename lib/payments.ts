import { roundCurrency } from '@/lib/inventory';

export const PAYMENT_METHODS = ['Cash', 'Card', 'E-Wallet', 'Bank Transfer'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentInput = {
  method: PaymentMethod;
  amount: number;
  referenceNumber?: string | null;
};

export type PaymentSummary = {
  totalPaid: number;
  remainingAmount: number;
  changeDue: number;
  cashReceived: number;
  hasCashPayment: boolean;
};

export function requiresReferenceNumber(method: PaymentMethod) {
  return method === 'Card' || method === 'E-Wallet' || method === 'Bank Transfer';
}

export function getPaymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case 'Cash':
      return 'Efectivo';
    case 'Card':
      return 'Tarjeta';
    case 'E-Wallet':
      return 'Billetera virtual';
    case 'Bank Transfer':
      return 'Transferencia bancaria';
    case 'Split':
      return 'Pago dividido';
    case 'Customer Credit':
    case 'Credit':
      return 'Cuenta corriente (Crédito)';
    default:
      return method || 'Otro';
  }
}

function normalizeReferenceNumber(referenceNumber?: string | null) {
  const normalized = referenceNumber?.trim() ?? '';
  return normalized || null;
}

export function normalizePaymentInput(payment: PaymentInput): PaymentInput {
  return {
    method: payment.method,
    amount: roundCurrency(Number(payment.amount ?? 0)),
    referenceNumber: normalizeReferenceNumber(payment.referenceNumber)
  };
}

export function getPaymentSummary(totalAmount: number, payments: PaymentInput[]): PaymentSummary {
  const normalizedPayments = payments.map(normalizePaymentInput);
  const totalPaid = roundCurrency(
    normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0)
  );
  const cashReceived = roundCurrency(
    normalizedPayments
      .filter((payment) => payment.method === 'Cash')
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
  const hasCashPayment = cashReceived > 0;
  const remainingAmount = roundCurrency(Math.max(totalAmount - totalPaid, 0));
  const changeDue = hasCashPayment
    ? roundCurrency(Math.max(totalPaid - totalAmount, 0))
    : 0;

  return {
    totalPaid,
    remainingAmount,
    changeDue,
    cashReceived,
    hasCashPayment
  };
}

export function validatePaymentsForSale(totalAmount: number, payments: PaymentInput[]) {
  const normalizedPayments = payments.map(normalizePaymentInput);

  if (!normalizedPayments.length) {
    return { ok: false as const, error: 'Agregue al menos un medio de pago.' };
  }

  if (normalizedPayments.some((payment) => payment.amount <= 0)) {
    return { ok: false as const, error: 'El monto de cada pago debe ser mayor a cero.' };
  }

  const seenReferenceKeys = new Set<string>();

  for (const payment of normalizedPayments) {
    if (requiresReferenceNumber(payment.method) && !payment.referenceNumber) {
      return {
        ok: false as const,
        error: `Los pagos con ${getPaymentMethodLabel(payment.method).toLowerCase()} requieren un número de referencia.`
      };
    }

    if (payment.referenceNumber) {
      const referenceKey = `${payment.method}:${payment.referenceNumber.toLowerCase()}`;
      if (seenReferenceKeys.has(referenceKey)) {
        return {
          ok: false as const,
          error: `No se permiten números de referencia duplicados para ${getPaymentMethodLabel(payment.method).toLowerCase()} en una misma venta.`
        };
      }
      seenReferenceKeys.add(referenceKey);
    }
  }

  const summary = getPaymentSummary(totalAmount, normalizedPayments);
  const nonCashTotal = roundCurrency(
    normalizedPayments
      .filter((payment) => payment.method !== 'Cash')
      .reduce((sum, payment) => sum + payment.amount, 0)
  );

  if (summary.totalPaid < totalAmount) {
    return {
      ok: false as const,
      error: 'El total abonado debe cubrir el importe total de la venta antes de finalizar el cobro.'
    };
  }

  if (summary.hasCashPayment && nonCashTotal > totalAmount) {
    return {
      ok: false as const,
      error: 'Solo el efectivo puede superar el saldo pendiente cuando corresponde entregar vuelto.'
    };
  }

  if (!summary.hasCashPayment && summary.totalPaid !== totalAmount) {
    return {
      ok: false as const,
      error: 'Los pagos que no sean en efectivo deben coincidir exactamente con el total de la venta.'
    };
  }

  return {
    ok: true as const,
    payments: normalizedPayments,
    summary
  };
}

export function getSalePaymentSummaryLabel(payments: Array<Pick<PaymentInput, 'method'>>) {
  const uniqueMethods = [...new Set(payments.map((payment) => payment.method))];
  return uniqueMethods.length === 1 ? uniqueMethods[0] : 'Split';
}

export const COMMON_BANKNOTE_DENOMINATIONS = [10000, 20000] as const;

function roundUpToStep(amount: number, step: number) {
  return roundCurrency(Math.ceil(amount / step) * step);
}

export function getQuickCashAmounts(amountDue: number) {
  if (amountDue <= 0) {
    return [];
  }

  const exactAmount = roundCurrency(amountDue);
  const candidates = [
    exactAmount,
    roundUpToStep(amountDue, 100),
    roundUpToStep(amountDue, 500),
    roundUpToStep(amountDue, 1000),
    roundUpToStep(amountDue, 2000),
    roundUpToStep(amountDue, 5000),
    roundUpToStep(amountDue, 10000),
    roundUpToStep(amountDue, 20000)
  ];

  if (amountDue <= 10000) {
    candidates.push(10000, 20000);
  } else if (amountDue <= 20000) {
    candidates.push(20000);
  }

  return [...new Set(candidates)]
    .filter((amount) => amount >= exactAmount)
    .sort((left, right) => left - right);
}
