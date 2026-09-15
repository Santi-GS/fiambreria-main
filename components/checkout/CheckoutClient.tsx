'use client';

import { type FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import ThermalReceipt from '@/components/receipts/ThermalReceipt';
import CustomerSearchModal from './CustomerSearchModal';
import ParkedSalesModal from './ParkedSalesModal';
import PaymentModal from './PaymentModal';
import PosCartTable from './PosCartTable';
import PosHeader from './PosHeader';
import ProductSearchModal from './ProductSearchModal';
import type { CartItem, Category, Customer, ParkedSale, PaymentLine, Product, ScanFeedback } from './types';
import { getCustomerDisplayName } from '@/lib/customers';
import { dateTime, money } from '@/lib/format';
import { roundCurrency } from '@/lib/inventory';
import {
  buildOfflineCheckoutDraftStorageKey,
  buildOfflineSalesQueueStorageKey,
  createOfflineClientRequestId,
  createOfflineReceiptNumber,
  getStockSnapshotAgeMinutes,
  readLocalStorageValue,
  removeLocalStorageValue,
  writeLocalStorageValue,
  type OfflineCheckoutDraft,
  type OfflineQueuedSale,
  type OfflineQueuedSaleItem,
  type OfflineReceiptSale
} from '@/lib/offline-checkout';
import {
  getPaymentSummary,
  getQuickCashAmounts,
  normalizePaymentInput,
  PAYMENT_METHODS,
  type PaymentMethod,
  validatePaymentsForSale
} from '@/lib/payments';
import { calculateTaxBreakdown, sanitizeDefaultPaymentMethods, type TaxModeValue } from '@/lib/shop-settings';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createPaymentLine(method: PaymentMethod): PaymentLine {
  return { id: crypto.randomUUID(), method, amount: '', referenceNumber: '' };
}

function buildInitialPaymentLines(defaultPaymentMethods: PaymentMethod[], canAcceptCash: boolean) {
  const preferredMethods = sanitizeDefaultPaymentMethods(defaultPaymentMethods).filter(
    (method) => canAcceptCash || method !== 'Cash'
  );

  return preferredMethods.length
    ? preferredMethods.map(createPaymentLine)
    : [createPaymentLine(canAcceptCash ? 'Cash' : 'Card')];
}

function toDateInputValue(value = new Date()) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function getReservedQtyForProduct(cart: CartItem[], productId: string, exceptOptionId?: string) {
  return cart.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (exceptOptionId && item.id === exceptOptionId) return sum;
    return sum + item.qty;
  }, 0);
}

function getQueueItemOptionId(item: Pick<OfflineQueuedSaleItem, 'productId' | 'variantId'>) {
  return item.variantId ?? item.productId;
}

function hasMeaningfulDraft(input: OfflineCheckoutDraft) {
  return (
    input.cart.length > 0 ||
    input.notes.trim().length > 0 ||
    input.customerName.trim().length > 0 ||
    input.customerPhone.trim().length > 0 ||
    input.customerSearch.trim().length > 0 ||
    input.selectedCustomerId !== null ||
    Number(input.discountAmount || 0) > 0 ||
    Number(input.loyaltyPointsToRedeem || 0) > 0 ||
    input.isCreditSale ||
    input.payments.some((payment) => payment.amount.trim().length > 0 || payment.referenceNumber.trim().length > 0)
  );
}

function buildInitialCheckoutPersistenceState({
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
    loyaltyPointsToRedeem: '0',
    isCreditSale: false,
    creditDueDate: toDateInputValue(),
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
    const product = productMap.get(entry.optionId);
    if (!product) {
      restoreNotes.push('Se omitió una línea del carrito guardado porque el producto ya no está disponible.');
      continue;
    }

    const reservedQty = getReservedQtyForProduct(restoredCart, product.productId);
    const availableQty = Math.max(product.stockQty - reservedQty, 0);
    const nextQty = Math.min(entry.qty, availableQty);

    if (nextQty <= 0) {
      restoreNotes.push(`${product.name} se omitió porque no hay existencias disponibles.`);
      continue;
    }

    if (nextQty < entry.qty) {
      restoreNotes.push(`${product.name} se redujo a ${nextQty} según las existencias actuales.`);
    }

    restoredCart.push({ ...product, qty: nextQty });
  }

  restored.selectedCategory = draft.selectedCategory;
  restored.query = draft.query;
  restored.cart = restoredCart;
  restored.discountAmount = draft.discountAmount;
  restored.customerSearch = draft.customerSearch;
  restored.selectedCustomerId = draft.selectedCustomerId;
  restored.customerName = draft.customerName;
  restored.customerPhone = draft.customerPhone;
  restored.loyaltyPointsToRedeem = draft.loyaltyPointsToRedeem;
  restored.isCreditSale = draft.isCreditSale;
  restored.creditDueDate = draft.creditDueDate || toDateInputValue();
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

type CheckoutClientProps = {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  taxRate: number;
  taxMode: TaxModeValue;
  currencySymbol: string;
  defaultPaymentMethods: PaymentMethod[];
  barcodeScannerNotes: string;
  cashierName: string;
  hasActiveCashSession: boolean;
  activeCashSessionId: string | null;
  shopId: string;
  userId: string;
  offlineStockStrict: boolean;
  offlineStockMaxAgeMinutes: number;
  stockSnapshotCapturedAt: string;
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  receiptHeader: string | null;
  receiptFooter: string | null;
  receiptWidth: '58mm' | '80mm';
  initialParkedSales: ParkedSale[];
};

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getOnlineServerSnapshot() {
  return true;
}

export default function CheckoutClient({
  products,
  categories,
  customers,
  taxRate,
  taxMode,
  currencySymbol,
  defaultPaymentMethods,
  cashierName,
  hasActiveCashSession,
  activeCashSessionId,
  shopId,
  userId,
  offlineStockStrict,
  offlineStockMaxAgeMinutes,
  stockSnapshotCapturedAt,
  shop,
  receiptHeader,
  receiptFooter,
  receiptWidth,
  initialParkedSales
}: CheckoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeParam = searchParams.get('resume');

  const draftStorageKey = useMemo(() => buildOfflineCheckoutDraftStorageKey(shopId, userId), [shopId, userId]);
  const queueStorageKey = useMemo(() => buildOfflineSalesQueueStorageKey(shopId, userId), [shopId, userId]);

  const [initialHydrated, setInitialHydrated] = useState(false);
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queuedSales, setQueuedSales] = useState<OfflineQueuedSale[]>([]);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [lastSyncedSale, setLastSyncedSale] = useState<{ id: string; localReceiptNumber: string; receiptNumber: string } | null>(null);

  // Modals state
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isParkedSalesOpen, setIsParkedSalesOpen] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  // Scanning state
  const [scanQuery, setScanQuery] = useState('');
  const [scanQty, setScanQty] = useState('1');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  // Cart & checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState('0');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [creditDueDate, setCreditDueDate] = useState(() => toDateInputValue());
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>(() =>
    buildInitialPaymentLines(defaultPaymentMethods, hasActiveCashSession)
  );

  // Parked sales & loading
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>(initialParkedSales);
  const [holding, setHolding] = useState<'SAVED_CART' | 'QUOTE' | null>(null);
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [parkedFeedback, setParkedFeedback] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Selected customer
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  // Focus scan input helper
  const focusScanInput = (select = false) => {
    requestAnimationFrame(() => {
      if (scanInputRef.current) {
        scanInputRef.current.focus();
        if (select) scanInputRef.current.select();
      }
    });
  };

  // Hydration effect
  useEffect(() => {
    const timer = setTimeout(() => {
      const restored = buildInitialCheckoutPersistenceState({
        draftStorageKey,
        queueStorageKey,
        products,
        defaultPaymentMethods,
        canAcceptCash: hasActiveCashSession
      });

      setQueuedSales(restored.queuedSales);
      setCart(restored.cart);
      setDiscountAmount(restored.discountAmount);
      setSelectedCustomerId(restored.selectedCustomerId);
      setCustomerName(restored.customerName);
      setCustomerPhone(restored.customerPhone);
      setLoyaltyPointsToRedeem(restored.loyaltyPointsToRedeem);
      setIsCreditSale(restored.isCreditSale);
      setCreditDueDate(restored.creditDueDate);
      setNotes(restored.notes);
      setPayments(restored.payments);
      if (restored.message) setParkedFeedback(restored.message);
      setInitialHydrated(true);
      focusScanInput();
    }, 0);

    return () => clearTimeout(timer);
  }, [draftStorageKey, queueStorageKey, products, defaultPaymentMethods, hasActiveCashSession]);

  // Sync draft to local storage
  useEffect(() => {
    if (!initialHydrated) return;

    const draft: OfflineCheckoutDraft = {
      version: 1,
      updatedAt: new Date().toISOString(),
      selectedCategory: '',
      query: '',
      cart: cart.map((item) => ({ optionId: item.id, qty: item.qty })),
      discountAmount,
      customerSearch: '',
      selectedCustomerId,
      customerName,
      customerPhone,
      loyaltyPointsToRedeem,
      isCreditSale,
      creditDueDate,
      notes,
      payments: payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
        referenceNumber: payment.referenceNumber
      }))
    };

    if (hasMeaningfulDraft(draft)) {
      writeLocalStorageValue(draftStorageKey, draft);
    } else {
      removeLocalStorageValue(draftStorageKey);
    }
  }, [
    initialHydrated,
    draftStorageKey,
    cart,
    discountAmount,
    selectedCustomerId,
    customerName,
    customerPhone,
    loyaltyPointsToRedeem,
    isCreditSale,
    creditDueDate,
    notes,
    payments
  ]);

  // Sync queued sales to local storage
  useEffect(() => {
    if (!initialHydrated) return;
    writeLocalStorageValue(queueStorageKey, queuedSales);
  }, [initialHydrated, queueStorageKey, queuedSales]);

  // Cart calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const subtotal = roundCurrency(rawSubtotal);
  const manualDiscount = Math.min(Math.max(toNumber(discountAmount), 0), subtotal);
  const loyaltyPointsCount = Math.max(Math.floor(toNumber(loyaltyPointsToRedeem)), 0);
  const loyaltyDiscount = Math.min(loyaltyPointsCount * 1, Math.max(subtotal - manualDiscount, 0));
  const discount = roundCurrency(manualDiscount + loyaltyDiscount);
  const taxBreakdown = calculateTaxBreakdown({
    subtotal,
    discountAmount: discount,
    taxRate,
    taxMode
  });
  const taxAmount = roundCurrency(taxBreakdown.taxAmount);
  const total = roundCurrency(taxBreakdown.totalAmount);
  const totalUnits = cart.reduce((sum, item) => sum + item.qty, 0);

  const paymentSummary = useMemo(
    () =>
      getPaymentSummary(
        total,
        isCreditSale
          ? []
          : payments.map((payment) => ({
              method: payment.method,
              amount: toNumber(payment.amount),
              referenceNumber: payment.referenceNumber
            }))
      ),
    [total, isCreditSale, payments]
  );

  const paymentValidation = useMemo(
    () =>
      validatePaymentsForSale(
        total,
        isCreditSale
          ? []
          : payments.map((payment) => ({
              method: payment.method,
              amount: toNumber(payment.amount),
              referenceNumber: payment.referenceNumber
            }))
      ),
    [total, isCreditSale, payments]
  );

  const paymentError = paymentValidation.error;
  const canCompleteSale = cart.length > 0 && (isCreditSale ? Boolean(selectedCustomerId) : !paymentError);

  // Cart actions
  const addToCart = (product: Product, quantityMultiplier = 1) => {
    const qtyToAdd = quantityMultiplier > 0 ? quantityMultiplier : 1;
    setCart((current) => {
      const existingIndex = current.findIndex((item) => item.id === product.id);
      const reservedQty = getReservedQtyForProduct(current, product.productId, product.id);
      const availableStock = Math.max(product.stockQty - reservedQty, 0);

      if (availableStock <= 0) {
        setScanFeedback({ tone: 'error', message: `${product.name} no tiene existencias disponibles.` });
        return current;
      }

      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        const nextQty = existing.qty + qtyToAdd;
        if (nextQty > availableStock) {
          setScanFeedback({
            tone: 'error',
            message: `Solo hay ${availableStock} unidad(es) de ${product.name}.`
          });
          return current;
        }

        const updated = [...current];
        updated[existingIndex] = { ...existing, qty: nextQty };
        setScanFeedback({ tone: 'success', message: `${product.name} actualizado (Cant: ${nextQty}).` });
        return updated;
      }

      if (qtyToAdd > availableStock) {
        setScanFeedback({
          tone: 'error',
          message: `Solo hay ${availableStock} unidad(es) de ${product.name}.`
        });
        return current;
      }

      setScanFeedback({ tone: 'success', message: `${product.name} agregado a la venta.` });
      return [{ ...product, qty: qtyToAdd }, ...current];
    });
  };

  const updateQty = (productId: string, action: 'increase' | 'decrease' | 'set', explicitValue?: number) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== productId) return item;
          const reservedQty = getReservedQtyForProduct(current, item.productId, item.id);
          const availableStock = Math.max(item.stockQty - reservedQty, 0);

          let nextQty = item.qty;
          if (action === 'increase') nextQty += 1;
          else if (action === 'decrease') nextQty -= 1;
          else if (action === 'set' && explicitValue !== undefined) nextQty = explicitValue;

          if (nextQty <= 0) return null;
          if (nextQty > availableStock) {
            setScanFeedback({
              tone: 'error',
              message: `No se puede exceder el stock disponible (${availableStock}).`
            });
            return item;
          }

          return { ...item, qty: nextQty };
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((current) => current.filter((item) => item.id !== productId));
  };

  const requestClearCart = () => {
    if (!cart.length) return;
    if (window.confirm('¿Desea vaciar todos los artículos del carrito actual?')) {
      resetCheckoutState();
    }
  };

  const resetCheckoutState = () => {
    setCart([]);
    setDiscountAmount('0');
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerPhone('');
    setLoyaltyPointsToRedeem('0');
    setIsCreditSale(false);
    setCreditDueDate(toDateInputValue());
    setNotes('');
    setPayments(buildInitialPaymentLines(defaultPaymentMethods, hasActiveCashSession));
    setScanQuery('');
    setScanQty('1');
    setScanFeedback(null);
    setError('');
    removeLocalStorageValue(draftStorageKey);
    setIsPaymentOpen(false);
    focusScanInput();
  };

  // Scan submit
  const handleScanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const queryTerm = scanQuery.trim().toLowerCase();
    if (!queryTerm) return;

    const matchedProduct = products.find(
      (p) =>
        p.barcode?.toLowerCase() === queryTerm ||
        p.sku?.toLowerCase() === queryTerm ||
        p.name.toLowerCase() === queryTerm
    );

    if (matchedProduct) {
      const parsedQty = parseFloat(scanQty);
      const qtyMultiplier = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
      addToCart(matchedProduct, qtyMultiplier);
      setScanQuery('');
      setScanQty('1');
      focusScanInput(true);
    } else {
      setScanFeedback({
        tone: 'error',
        message: `No se encontró ningún producto con el código o SKU "${scanQuery}".`
      });
    }
  };

  // Payment Lines
  const updatePaymentLine = (id: string, updates: Partial<PaymentLine>) => {
    setPayments((current) =>
      current.map((line) => (line.id === id ? { ...line, ...updates } : line))
    );
  };

  const addPaymentLine = () => {
    setPayments((current) => [...current, createPaymentLine(hasActiveCashSession ? 'Cash' : 'Card')]);
  };

  const removePaymentLine = (id: string) => {
    setPayments((current) => current.filter((line) => line.id !== id));
  };

  const setPaymentLineAmount = (id: string, amount: number) => {
    updatePaymentLine(id, { amount: amount.toFixed(2) });
  };

  const getExactAmountForLine = (lineId: string) => {
    const otherPaid = payments
      .filter((line) => line.id !== lineId)
      .reduce((sum, line) => sum + toNumber(line.amount), 0);
    return Math.max(roundCurrency(total - otherPaid), 0);
  };

  // Parked sales hold / resume / cancel
  const saveCheckoutDraft = async (type: 'SAVED_CART' | 'QUOTE') => {
    if (!cart.length) return;
    setError('');
    setParkedFeedback('');
    setHolding(type);

    try {
      const response = await fetch('/api/parked-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          customerId: selectedCustomerId,
          customerName: customerName || (selectedCustomer ? getCustomerDisplayName(selectedCustomer) : null),
          customerPhone: customerPhone || selectedCustomer?.phone || null,
          notes: notes || null,
          items: cart.map((item) => ({
            productId: item.productId,
            productVariantId: item.variantId,
            qty: item.qty,
            unitPrice: item.price
          }))
        })
      });

      const data = await response.json();
      setHolding(null);
      if (!response.ok) {
        setError(data.error ?? 'No fue posible guardar el carrito.');
        return;
      }

      setParkedSales((current) => [data.parkedSale, ...current]);
      setParkedFeedback(
        type === 'QUOTE'
          ? `Cotización guardada como ${data.parkedSale.quoteReference ?? 'activa'}.`
          : 'Venta suspendida y guardada en espera exitosamente.'
      );
      resetCheckoutState();
    } catch {
      setHolding(null);
      setError('Error de conexión al guardar el registro.');
    }
  };

  const resumeParkedSale = async (parkedSale: ParkedSale, options?: { clearSearchParamAfter?: boolean }) => {
    setError('');
    setParkedFeedback('');
    setResumeLoadingId(parkedSale.id);

    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}/resume`, { method: 'POST' });
      const data = await response.json();
      setResumeLoadingId(null);

      if (!response.ok) {
        setError(data.error ?? 'No fue posible retomar la venta.');
        return false;
      }

      // Reconstruct cart from restored lines
      const restoredCart: CartItem[] = [];
      for (const item of parkedSale.items) {
        const optionId = item.productVariantId ?? item.productId;
        const option = productMap.get(optionId);
        if (option) {
          restoredCart.push({ ...option, qty: item.qty });
        }
      }

      setCart(restoredCart);
      setSelectedCustomerId(parkedSale.customerId);
      setCustomerName(parkedSale.customerName ?? '');
      setCustomerPhone(parkedSale.customerPhone ?? '');
      setNotes(parkedSale.notes ?? '');
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setParkedFeedback(`Se cargó ${parkedSale.type === 'QUOTE' ? 'la cotización' : 'el carrito en espera'}.`);
      focusScanInput();
      if (options?.clearSearchParamAfter) router.replace('/checkout');
      return true;
    } catch {
      setResumeLoadingId(null);
      setError('Error al cargar la venta guardada.');
      return false;
    }
  };

  const cancelParkedSale = async (parkedSale: ParkedSale) => {
    if (!window.confirm('¿Cancelar este registro guardado? Se eliminará de la lista activa.')) return;
    setCancelLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}`, { method: 'DELETE' });
      setCancelLoadingId(null);
      if (response.ok) {
        setParkedSales((current) => current.filter((e) => e.id !== parkedSale.id));
        setParkedFeedback('Registro en espera cancelado.');
      }
    } catch {
      setCancelLoadingId(null);
      setError('Error al cancelar el registro.');
    }
  };

  const handleResumeParamEvent = useEffectEvent((target: ParkedSale) => {
    void resumeParkedSale(target, { clearSearchParamAfter: true });
  });

  // Handle URL resume parameter
  useEffect(() => {
    if (!resumeParam || !initialHydrated) return;
    const targetParkedSale = parkedSales.find((entry) => entry.id === resumeParam);
    if (!targetParkedSale) return;
    handleResumeParamEvent(targetParkedSale);
  }, [resumeParam, initialHydrated, parkedSales]);

  // Complete Sale
  const completeSale = async () => {
    setError('');
    setParkedFeedback('');
    if (!cart.length) return setError('Por favor agregue productos al carrito.');
    if (paymentError && !isCreditSale) return setError(paymentError);

    const occurredAt = new Date().toISOString();
    const clientRequestId = createOfflineClientRequestId(shopId, userId, new Date(occurredAt));

    const salePayload = {
      clientRequestId,
      shopId,
      customerId: selectedCustomerId,
      customerName: customerName || (selectedCustomer ? getCustomerDisplayName(selectedCustomer) : null),
      customerPhone: customerPhone || selectedCustomer?.phone || null,
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: discount.toFixed(2),
      totalAmount: total.toFixed(2),
      changeDue: paymentSummary.changeDue.toFixed(2),
      paymentMethod: isCreditSale ? 'Credit' : payments[0]?.method ?? 'Cash',
      isCreditSale,
      creditDueDate: isCreditSale ? creditDueDate : null,
      loyaltyPointsRedeemed: loyaltyPointsCount,
      notes: notes || null,
      items: cart.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        qty: item.qty
      })),
      payments: isCreditSale
        ? []
        : payments.map((p) => ({
            method: p.method,
            amount: toNumber(p.amount),
            referenceNumber: p.referenceNumber || null
          }))
    };

    if (!isOnline) {
      // Enqueue offline
      const localReceiptNumber = createOfflineReceiptNumber(new Date(occurredAt));
      const offlineSale: OfflineQueuedSale = {
        id: crypto.randomUUID(),
        shopId,
        userId,
        localReceiptNumber,
        queuedAt: occurredAt,
        status: 'PENDING',
        lastError: null,
        conflicts: [],
        payload: {
          clientRequestId,
          occurredAt,
          cashSessionId: activeCashSessionId,
          customerId: selectedCustomerId,
          customerName: customerName || (selectedCustomer ? getCustomerDisplayName(selectedCustomer) : null),
          customerPhone: customerPhone || selectedCustomer?.phone || null,
          loyaltyPointsToRedeem: loyaltyPointsCount,
          isCreditSale,
          creditDueDate: isCreditSale ? creditDueDate : null,
          discountAmount: discount,
          notes: notes || null,
          payments: isCreditSale
            ? []
            : payments.map((p) => ({
                method: p.method,
                amount: toNumber(p.amount),
                referenceNumber: p.referenceNumber || null
              })),
          items: cart.map((item) => ({
            optionId: item.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.name,
            variantLabel: item.variantLabel,
            qty: item.qty,
            priceSnapshot: Number(item.price)
          }))
        },
        receipt: {
          id: `offline-${clientRequestId}`,
          saleNumber: localReceiptNumber,
          receiptNumber: localReceiptNumber,
          paymentMethod: isCreditSale ? 'Credit' : payments[0]?.method ?? 'Cash',
          cashierName,
          customerName: customerName || (selectedCustomer ? getCustomerDisplayName(selectedCustomer) : null),
          customerPhone: customerPhone || selectedCustomer?.phone || null,
          customerBusinessName: selectedCustomer?.businessName ?? null,
          customerEmail: selectedCustomer?.email ?? null,
          isCreditSale,
          creditDueDate: isCreditSale ? creditDueDate : null,
          loyaltyPointsEarned: 0,
          loyaltyPointsRedeemed: loyaltyPointsCount,
          loyaltyDiscountAmount: loyaltyDiscount.toFixed(2),
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discount.toFixed(2),
          totalAmount: total.toFixed(2),
          totalPaid: paymentSummary.totalPaid.toFixed(2),
          cashReceived: paymentSummary.cashReceived.toFixed(2),
          changeDue: paymentSummary.changeDue.toFixed(2),
          notes: notes || null,
          createdAt: occurredAt,
          payments: isCreditSale
            ? []
            : payments.map((p) => ({
                id: p.id,
                method: p.method,
                amount: toNumber(p.amount).toFixed(2),
                referenceNumber: p.referenceNumber || null,
                createdAt: occurredAt
              })),
          items: cart.map((item) => ({
            id: `item-${item.id}`,
            productName: item.name,
            qty: item.qty,
            unitPrice: item.price,
            lineTotal: (Number(item.price) * item.qty).toFixed(2)
          }))
        }
      };

      setQueuedSales((cur) => [offlineSale, ...cur]);
      setActiveReceiptId(offlineSale.id);
      resetCheckoutState();
      setParkedFeedback(`Venta ${localReceiptNumber} guardada en cola sin conexión.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload)
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error ?? 'No fue posible procesar la venta.');
        return;
      }

      resetCheckoutState();
      router.push(`/print/receipt/${data.sale.id}?autoprint=1`);
      router.refresh();
    } catch {
      setLoading(false);
      setError('Error al registrar la venta en el servidor.');
    }
  };

  // Keyboard Shortcuts
  const handleOpenProductSearchEvent = useEffectEvent(() => {
    setIsProductSearchOpen(true);
  });

  const handleOpenPaymentEvent = useEffectEvent(() => {
    if (cart.length > 0) setIsPaymentOpen(true);
  });

  const handleOpenCustomerEvent = useEffectEvent(() => {
    setIsCustomerSearchOpen(true);
  });

  const handleOpenParkedSalesEvent = useEffectEvent(() => {
    setIsParkedSalesOpen(true);
  });

  const handleNewSaleEvent = useEffectEvent(() => {
    requestClearCart();
  });

  const handleCloseAllModalsEvent = useEffectEvent(() => {
    setIsProductSearchOpen(false);
    setIsPaymentOpen(false);
    setIsParkedSalesOpen(false);
    setIsCustomerSearchOpen(false);
    focusScanInput();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Escape closes everything and focuses scanner
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseAllModalsEvent();
        return;
      }

      // Hotkey: Ctrl+B or Alt+B (Buscar producto)
      if ((event.ctrlKey || event.altKey) && (event.key === 'b' || event.key === 'B')) {
        event.preventDefault();
        handleOpenProductSearchEvent();
        return;
      }

      // Hotkey: Ctrl+Enter or Alt+C (Cobrar / Facturar)
      if ((event.ctrlKey && event.key === 'Enter') || (event.altKey && (event.key === 'c' || event.key === 'C'))) {
        event.preventDefault();
        handleOpenPaymentEvent();
        return;
      }

      // Hotkey: Ctrl+K or Alt+U (Buscar cliente)
      if ((event.ctrlKey && (event.key === 'k' || event.key === 'K')) || (event.altKey && (event.key === 'u' || event.key === 'U'))) {
        event.preventDefault();
        handleOpenCustomerEvent();
        return;
      }

      // Hotkey: Alt+E (Ventas en espera)
      if (event.altKey && (event.key === 'e' || event.key === 'E')) {
        event.preventDefault();
        handleOpenParkedSalesEvent();
        return;
      }

      // Hotkey: Alt+N (Nueva venta)
      if (event.altKey && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault();
        handleNewSaleEvent();
        return;
      }

      // Single-key shortcuts when not typing in any text box:
      if (isTypingTarget(event.target)) return;

      if (event.key === '/') {
        event.preventDefault();
        handleOpenProductSearchEvent();
      } else if (event.key === '+' || event.key === ' ') {
        event.preventDefault();
        handleOpenPaymentEvent();
      } else if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        handleOpenCustomerEvent();
      } else if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        handleOpenParkedSalesEvent();
      } else if (event.key === 'Delete') {
        event.preventDefault();
        handleNewSaleEvent();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeReceiptSale = useMemo(
    () => queuedSales.find((item) => item.id === activeReceiptId) ?? null,
    [queuedSales, activeReceiptId]
  );

  return (
    <div className="space-y-4">
      {/* Offline Status & Notice Bar if any */}
      {!isOnline || queuedSales.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}
            />
            <span className="font-bold">{isOnline ? 'Terminal En Línea' : 'Modo Sin Conexión Activado'}</span>
            <span>• {queuedSales.length} venta(s) guardadas en cola local</span>
          </div>

          <div className="flex items-center gap-2">
            {activeReceiptSale ? (
              <button
                type="button"
                onClick={() => setActiveReceiptId(activeReceiptSale.id)}
                className="font-bold underline hover:text-amber-950"
              >
                Ver recibo temporal ({activeReceiptSale.localReceiptNumber})
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Main POS Header */}
      <PosHeader
        scanInputRef={scanInputRef}
        scanQuery={scanQuery}
        onScanQueryChange={setScanQuery}
        scanQty={scanQty}
        onScanQtyChange={setScanQty}
        onScanSubmit={handleScanSubmit}
        onOpenProductSearch={() => setIsProductSearchOpen(true)}
        onOpenPayment={() => setIsPaymentOpen(true)}
        onOpenParkedSales={() => setIsParkedSalesOpen(true)}
        onOpenCustomerSearch={() => setIsCustomerSearchOpen(true)}
        onNewSale={requestClearCart}
        onRequestClearCart={requestClearCart}
        selectedCustomer={selectedCustomer}
        onClearCustomer={() => setSelectedCustomerId(null)}
        parkedSalesCount={parkedSales.length}
        cartItemCount={cart.length}
        cartTotalUnits={totalUnits}
        totalAmount={total}
        currencySymbol={currencySymbol}
        canCompleteSale={cart.length > 0}
      />

      {/* Notifications / Feedback */}
      {scanFeedback ? (
        <div
          className={`rounded-2xl border px-4 py-2.5 text-xs font-bold transition ${
            scanFeedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {scanFeedback.message}
        </div>
      ) : null}

      {parkedFeedback ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-800">
          {parkedFeedback}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-800">
          {error}
        </div>
      ) : null}

      {/* Full-width Cart Table */}
      <PosCartTable
        cart={cart}
        currencySymbol={currencySymbol}
        onUpdateQty={updateQty}
        onRemoveItem={removeFromCart}
        onOpenProductSearch={() => setIsProductSearchOpen(true)}
      />

      {/* Offline Receipt Preview if active */}
      {activeReceiptSale ? (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-black text-stone-900">Recibo Local Sin Conexión</h4>
            <button
              type="button"
              onClick={() => setActiveReceiptId(null)}
              className="text-xs text-stone-500 hover:text-stone-800"
            >
              Ocultar
            </button>
          </div>
          <ThermalReceipt
            sale={activeReceiptSale.receipt}
            shop={shop}
            currencySymbol={currencySymbol}
            receiptHeader={receiptHeader}
            receiptFooter={receiptFooter}
            receiptWidth={receiptWidth}
          />
        </Card>
      ) : null}

      {/* Popups & Modals */}
      <ProductSearchModal
        isOpen={isProductSearchOpen}
        onClose={() => {
          setIsProductSearchOpen(false);
          focusScanInput();
        }}
        products={products}
        categories={categories}
        currencySymbol={currencySymbol}
        onSelectProduct={(product) => {
          const parsedQty = parseFloat(scanQty);
          const qtyMultiplier = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
          addToCart(product, qtyMultiplier);
          setScanQty('1');
          focusScanInput();
        }}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          focusScanInput();
        }}
        currencySymbol={currencySymbol}
        subtotal={subtotal}
        taxRate={taxRate}
        taxAmount={taxAmount}
        manualDiscount={manualDiscount}
        discountAmount={discountAmount}
        onDiscountAmountChange={setDiscountAmount}
        loyaltyDiscount={loyaltyDiscount}
        loyaltyPointsToRedeem={loyaltyPointsToRedeem}
        onLoyaltyPointsChange={setLoyaltyPointsToRedeem}
        total={total}
        payments={payments}
        onUpdatePaymentLine={updatePaymentLine}
        onAddPaymentLine={addPaymentLine}
        onRemovePaymentLine={removePaymentLine}
        onSetPaymentLineAmount={setPaymentLineAmount}
        canAcceptCash={hasActiveCashSession}
        isCreditSale={isCreditSale}
        onIsCreditSaleChange={setIsCreditSale}
        creditDueDate={creditDueDate}
        onCreditDueDateChange={setCreditDueDate}
        notes={notes}
        onNotesChange={setNotes}
        selectedCustomer={selectedCustomer}
        paymentSummary={paymentSummary}
        getQuickCashAmounts={getQuickCashAmounts}
        getExactAmountForLine={getExactAmountForLine}
        paymentError={paymentError}
        loading={loading}
        isOnline={isOnline}
        canCompleteSale={canCompleteSale}
        onCompleteSale={completeSale}
      />

      <ParkedSalesModal
        isOpen={isParkedSalesOpen}
        onClose={() => {
          setIsParkedSalesOpen(false);
          focusScanInput();
        }}
        parkedSales={parkedSales}
        currencySymbol={currencySymbol}
        resumeLoadingId={resumeLoadingId}
        cancelLoadingId={cancelLoadingId}
        onResume={resumeParkedSale}
        onCancel={cancelParkedSale}
        onSaveCurrentCart={saveCheckoutDraft}
        holding={holding}
        canSaveCurrent={cart.length > 0}
      />

      <CustomerSearchModal
        isOpen={isCustomerSearchOpen}
        onClose={() => {
          setIsCustomerSearchOpen(false);
          focusScanInput();
        }}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        currencySymbol={currencySymbol}
        onSelectCustomer={(c) => {
          setSelectedCustomerId(c?.id ?? null);
          focusScanInput();
        }}
      />
    </div>
  );
}
