import { formatDateInputValue } from '@/lib/format';
import {
  readLocalStorageValue,
  type OfflineCheckoutDraft,
  type OfflineQueuedSale
} from '@/lib/offline-checkout';
import { type PaymentMethod } from '@/lib/payments';
import { getBaseOptionId, getReservedDbUnitsForProduct } from '@/lib/pos-stock';
import { sanitizeDefaultPaymentMethods } from '@/lib/shop-settings';
import type { CartItem, PaymentLine, Product } from './types';

export function createPaymentLine(method: PaymentMethod): PaymentLine {
  return { id: crypto.randomUUID(), method, amount: '', referenceNumber: '' };
}

export function buildInitialPaymentLines(
  defaultPaymentMethods: PaymentMethod[],
  canAcceptCash: boolean
) {
  const preferredMethods = sanitizeDefaultPaymentMethods(defaultPaymentMethods).filter(
    (method) => canAcceptCash || method !== 'Cash'
  );

  return preferredMethods.length
    ? preferredMethods.map(createPaymentLine)
    : [createPaymentLine(canAcceptCash ? 'Cash' : 'Card')];
}

export function hasMeaningfulDraft(input: OfflineCheckoutDraft) {
  return (
    input.cart.length > 0 ||
    input.notes.trim().length > 0 ||
    input.customerName.trim().length > 0 ||
    input.customerPhone.trim().length > 0 ||
    input.customerSearch.trim().length > 0 ||
    input.selectedCustomerId !== null ||
    Number(input.discountAmount || 0) > 0 ||
    input.isCreditSale ||
    input.payments.some(
      (payment) =>
        payment.amount.trim().length > 0 || payment.referenceNumber.trim().length > 0
    )
  );
}

export function buildInitialCheckoutPersistenceState({
  draftStorageKey,
  queueStorageKey,
  products,
  defaultPaymentMethods,
  canAcceptCash
}: {
  draftStorageKey: string;
  queueStorageKey: string;
  products: Product[];
  defaultPaymentMethods: PaymentMethod[];
  canAcceptCash: boolean;
}) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const fallbackPayments = buildInitialPaymentLines(defaultPaymentMethods, canAcceptCash);
  const restored = {
    queuedSales: readLocalStorageValue<OfflineQueuedSale[]>(queueStorageKey, []),
    selectedCategory: '',
    query: '',
    cart: [] as CartItem[],
    discountAmount: '0',
    customerSearch: '',
    selectedCustomerId: null as string | null,
    customerName: '',
    customerPhone: '',
    isCreditSale: false,
    creditDueDate: formatDateInputValue(),
    notes: '',
    payments: fallbackPayments,
    message: ''
  };

  const draft = readLocalStorageValue<OfflineCheckoutDraft | null>(draftStorageKey, null);
  if (draft?.version !== 1) {
    return restored;
  }

  const restoredCart: CartItem[] = [];
  const restoreNotes: string[] = [];

  for (const entry of draft.cart) {
    const baseOptionId = getBaseOptionId(entry.optionId);
    const product = productMap.get(baseOptionId);
    if (!product) {
      restoreNotes.push(
        'Se omitió una línea del carrito guardado porque el producto ya no está disponible.'
      );
      continue;
    }

    const isWeighted = product.baseUnitCode === 'KG';
    const reservedDbUnits = getReservedDbUnitsForProduct(
      restoredCart,
      product.productId,
      isWeighted
    );
    const availableDbUnits = Math.max(product.stockQty - reservedDbUnits, 0);

    if (isWeighted) {
      const requestedGrams = Math.round(entry.qty * 1000);
      const nextGrams = Math.min(requestedGrams, availableDbUnits);

      if (nextGrams <= 0) {
        restoreNotes.push(
          `${product.name} se omitió porque no hay existencias disponibles.`
        );
        continue;
      }

      const nextQtyKg = nextGrams / 1000;
      if (nextGrams < requestedGrams) {
        restoreNotes.push(
          `${product.name} se redujo a ${nextQtyKg.toFixed(3).replace('.', ',')} Kg según las existencias actuales.`
        );
      }

      restoredCart.push({ ...product, id: entry.optionId, qty: nextQtyKg });
    } else {
      const nextQty = Math.min(entry.qty, availableDbUnits);

      if (nextQty <= 0) {
        restoreNotes.push(
          `${product.name} se omitió porque no hay existencias disponibles.`
        );
        continue;
      }

      if (nextQty < entry.qty) {
        restoreNotes.push(
          `${product.name} se redujo a ${nextQty} según las existencias actuales.`
        );
      }

      restoredCart.push({ ...product, qty: nextQty });
    }
  }

  restored.selectedCategory = draft.selectedCategory;
  restored.query = draft.query;
  restored.cart = restoredCart;
  restored.discountAmount = draft.discountAmount;
  restored.customerSearch = draft.customerSearch;
  restored.selectedCustomerId = draft.selectedCustomerId;
  restored.customerName = draft.customerName;
  restored.customerPhone = draft.customerPhone;
  restored.isCreditSale = draft.isCreditSale;
  restored.creditDueDate = draft.creditDueDate || formatDateInputValue();
  restored.notes = draft.notes;
  restored.payments = draft.payments.length
    ? draft.payments.map((payment) => ({
        id: payment.id || crypto.randomUUID(),
        method: payment.method,
        amount: payment.amount,
        referenceNumber: payment.referenceNumber
      }))
    : fallbackPayments;

  if (restoredCart.length) {
    restored.message = 'Se restauró el último borrador de cobro de esta terminal.';
  }

  if (restoreNotes.length) {
    restored.message = `${restored.message} ${restoreNotes.join(' ')}`.trim();
  }

  return restored;
}
