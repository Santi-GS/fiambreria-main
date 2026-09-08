'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ThermalReceipt from '@/components/receipts/ThermalReceipt';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
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
  getSalePaymentSummaryLabel,
  normalizePaymentInput,
  PAYMENT_METHODS,
  type PaymentMethod,
  requiresReferenceNumber,
  validatePaymentsForSale
} from '@/lib/payments';
import { calculateTaxBreakdown, sanitizeDefaultPaymentMethods, type TaxModeValue } from '@/lib/shop-settings';

type Category = { id: string; name: string };
type Product = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  barcode: string | null;
  sku: string | null;
  price: string;
  stockQty: number;
  categoryId: string | null;
  imageUrl: string | null;
  category?: { id: string; name: string } | null;
};
type CartItem = Product & { qty: number };
type Customer = {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  loyaltyBalance: number;
  receivableBalance: string;
  lastPurchaseAt: string | null;
};
type ScanFeedback = { tone: 'success' | 'error'; message: string } | null;
type PaymentLine = {
  id: string;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string;
};
type ParkedSale = {
  id: string;
  shopId: string;
  cashierUserId: string;
  customerId: string | null;
  cashierName: string;
  cashierEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  title: string | null;
  quoteReference: string | null;
  type: 'SAVED_CART' | 'QUOTE';
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: 'HELD' | 'RESUMED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  resumedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: Array<{
    id: string;
    productId: string;
    productVariantId: string | null;
    productName: string;
    variantLabel: string | null;
    qty: number;
    unitPrice: string;
    lineTotal: string;
    createdAt: string;
  }>;
};

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

function getOptionDisplayName(product: Pick<Product, 'name' | 'variantLabel'>) {
  return product.variantLabel ? `${product.name} - ${product.variantLabel}` : product.name;
}

function getReservedQtyForProduct(items: CartItem[], productId: string, exceptOptionId?: string) {
  return items.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (exceptOptionId && item.id === exceptOptionId) return sum;
    return sum + item.qty;
  }, 0);
}

function getQueuedSaleStatusLabel(status: OfflineQueuedSale['status']) {
  switch (status) {
    case 'SYNCING':
      return 'Sincronizando';
    case 'CONFLICT':
      return 'Requiere revisión';
    case 'ERROR':
      return 'Reintento necesario';
    default:
      return 'En cola';
  }
}

function getQueuedSaleStatusTone(status: OfflineQueuedSale['status']) {
  switch (status) {
    case 'SYNCING':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'CONFLICT':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'ERROR':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
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

export default function CheckoutClient({
  products,
  categories,
  customers,
  taxRate,
  taxMode,
  currencySymbol,
  defaultPaymentMethods,
  barcodeScannerNotes,
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
}: {
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartItem[]>([]);
  const queuedSalesRef = useRef<OfflineQueuedSale[]>([]);
  const syncInFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const handledSearchParamResumeRef = useRef<string | null>(null);
  const canAcceptCash = hasActiveCashSession;
  const draftStorageKey = useMemo(
    () => buildOfflineCheckoutDraftStorageKey(shopId, userId),
    [shopId, userId]
  );
  const queueStorageKey = useMemo(
    () => buildOfflineSalesQueueStorageKey(shopId, userId),
    [shopId, userId]
  );
  const [initialLocalState] = useState(() =>
    buildInitialCheckoutPersistenceState({
      draftStorageKey,
      queueStorageKey,
      products,
      defaultPaymentMethods,
      canAcceptCash
    })
  );

  const [selectedCategory, setSelectedCategory] = useState(initialLocalState.selectedCategory);
  const [query, setQuery] = useState(initialLocalState.query);
  const [scanQuery, setScanQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>(initialLocalState.cart);
  const [discountAmount, setDiscountAmount] = useState(initialLocalState.discountAmount);
  const [customerSearch, setCustomerSearch] = useState(initialLocalState.customerSearch);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialLocalState.selectedCustomerId);
  const [customerName, setCustomerName] = useState(initialLocalState.customerName);
  const [customerPhone, setCustomerPhone] = useState(initialLocalState.customerPhone);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(initialLocalState.loyaltyPointsToRedeem);
  const [isCreditSale, setIsCreditSale] = useState(initialLocalState.isCreditSale);
  const [creditDueDate, setCreditDueDate] = useState(initialLocalState.creditDueDate);
  const [notes, setNotes] = useState(initialLocalState.notes);
  const [payments, setPayments] = useState<PaymentLine[]>(initialLocalState.payments);
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>(initialParkedSales);
  const [queuedSales, setQueuedSales] = useState<OfflineQueuedSale[]>(initialLocalState.queuedSales);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [lastSyncedSale, setLastSyncedSale] = useState<{
    id: string;
    saleNumber: string;
    receiptNumber: string;
    localReceiptNumber: string;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
  const [parkedFeedback, setParkedFeedback] = useState(initialLocalState.message);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState<'SAVED_CART' | 'QUOTE' | null>(null);
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const hasSearchFilters = Boolean(query.trim() || selectedCategory);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    return products
      .filter((product) => {
        const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
        const matchesTerm =
          !term ||
          [product.name, product.variantLabel ?? '', product.barcode ?? '', product.sku ?? '', product.category?.name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(term);
        return matchesCategory && matchesTerm;
      })
      .slice(0, 30);
  }, [products, query, selectedCategory]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) {
      return customers.slice(0, 6);
    }

    return customers
      .filter((customer) =>
        [
          getCustomerDisplayName(customer),
          customer.phone ?? '',
          customer.email ?? '',
          customer.businessName ?? '',
          customer.contactPerson ?? ''
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 6);
  }, [customerSearch, customers]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const manualDiscount = Number(discountAmount || 0);
  const loyaltyDiscount = Number(loyaltyPointsToRedeem || 0);
  const discount = manualDiscount + loyaltyDiscount;
  const taxPreview = calculateTaxBreakdown({
    subtotal,
    discountAmount: discount,
    taxRate,
    taxMode
  });
  const taxAmount = taxPreview.taxAmount;
  const total = taxPreview.totalAmount;

  const paymentInputs = useMemo(
    () =>
      payments.map((payment) =>
        normalizePaymentInput({
          method: payment.method,
          amount: toNumber(payment.amount),
          referenceNumber: payment.referenceNumber.trim() || null
        })
      ),
    [payments]
  );

  const paymentSummary = useMemo(
    () =>
      isCreditSale
        ? {
            totalPaid: 0,
            remainingAmount: total,
            changeDue: 0,
            cashReceived: 0,
            hasCashPayment: false
          }
        : getPaymentSummary(total, paymentInputs),
    [isCreditSale, paymentInputs, total]
  );

  const paymentError = useMemo(() => {
    if (isCreditSale) {
      if (!selectedCustomerId) return 'Asigne un cliente antes de registrar una venta a crédito.';
      if (!creditDueDate) return 'Seleccione una fecha de vencimiento para la venta a crédito.';
      if (
        Number(loyaltyPointsToRedeem) > 0 &&
        selectedCustomer &&
        Number(loyaltyPointsToRedeem) > selectedCustomer.loyaltyBalance
      ) {
        return 'El cliente no tiene suficientes puntos de fidelidad para este canje.';
      }
      return '';
    }

    if (Number(loyaltyPointsToRedeem) > 0) {
      if (!selectedCustomerId) return 'Asigne un cliente antes de canjear puntos de fidelidad.';
      if (selectedCustomer && Number(loyaltyPointsToRedeem) > selectedCustomer.loyaltyBalance) {
        return 'El cliente no tiene suficientes puntos de fidelidad para este canje.';
      }
    }

    const paymentValidation = validatePaymentsForSale(total, paymentInputs);
    if (!paymentValidation.ok) return paymentValidation.error;
    return '';
  }, [
    creditDueDate,
    isCreditSale,
    loyaltyPointsToRedeem,
    paymentInputs,
    paymentSummary,
    payments.length,
    selectedCustomer,
    selectedCustomerId,
    total
  ]);

  const stockSnapshotAgeMinutes = getStockSnapshotAgeMinutes(stockSnapshotCapturedAt, clock);
  const isStockSnapshotStale = stockSnapshotAgeMinutes > offlineStockMaxAgeMinutes;
  const offlineCheckoutBlocked = !isOnline && offlineStockStrict && isStockSnapshotStale;
  const canCompleteSale =
    cart.length > 0 &&
    !loading &&
    discount >= 0 &&
    discount <= subtotal + taxAmount &&
    !paymentError &&
    !offlineCheckoutBlocked;

  const pendingQueuedSales = queuedSales.filter((sale) => sale.status === 'PENDING');
  const conflictedQueuedSales = queuedSales.filter((sale) => sale.status === 'CONFLICT');
  const failedQueuedSales = queuedSales.filter((sale) => sale.status === 'ERROR');
  const resolvedActiveReceiptId =
    activeReceiptId && queuedSales.some((sale) => sale.id === activeReceiptId)
      ? activeReceiptId
      : queuedSales[0]?.id ?? null;
  const activeReceiptSale = queuedSales.find((sale) => sale.id === resolvedActiveReceiptId) ?? null;

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    queuedSalesRef.current = queuedSales;
  }, [queuedSales]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function focusScanInput(selectText = false) {
    const input = scanInputRef.current;
    if (!input) return;
    input.focus();
    if (selectText) input.select();
  }

  useEffect(() => {
    focusScanInput();
  }, []);

  function resetPayments() {
    setPayments(buildInitialPaymentLines(defaultPaymentMethods, canAcceptCash));
  }
  const clearCartState = () => {
    setCart([]);
    setSelectedCustomerId(null);
    setCustomerSearch('');
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount('0');
    setLoyaltyPointsToRedeem('0');
    setIsCreditSale(false);
    setCreditDueDate(toDateInputValue());
    setNotes('');
    setScanQuery('');
    setScanFeedback(null);
    setError('');
    resetPayments();
  };

  function resetCheckoutState() {
    setCart([]);
    setDiscountAmount('0');
    setCustomerSearch('');
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerPhone('');
    setLoyaltyPointsToRedeem('0');
    setIsCreditSale(false);
    setCreditDueDate(toDateInputValue());
    setNotes('');
    setScanQuery('');
    setScanFeedback(null);
    setError('');
    resetPayments();
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(getCustomerDisplayName(customer));
    setCustomerName(getCustomerDisplayName(customer));
    setCustomerPhone(customer.phone ?? '');
    setError('');
  }

  function addToCart(product: Product) {
    setError('');
    setParkedFeedback('');
    const existing = cartRef.current.find((item) => item.id === product.id);
    const reservedQty = getReservedQtyForProduct(cartRef.current, product.productId);

    if (existing) {
      if (reservedQty + 1 > product.stockQty) {
        setError(`No se puede sobrevender. ${product.name} solo tiene ${product.stockQty} en existencias.`);
        return false;
      }
      setCart((current) => current.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item)));
      return true;
    }

    if (product.stockQty <= 0) {
      setError(`${product.name} está agotado.`);
      return false;
    }

    if (reservedQty + 1 > product.stockQty) {
      setError(`No se puede sobrevender. ${product.name} solo tiene ${product.stockQty} en existencias.`);
      return false;
    }

    setCart((current) => [...current, { ...product, qty: 1 }]);
    return true;
  }

  function updateQty(optionId: string, direction: 'increase' | 'decrease') {
    const product = productMap.get(optionId);
    if (!product) return;
    setError('');
    setScanFeedback(null);
    setParkedFeedback('');
    setCart((current) => {
      const existing = current.find((item) => item.id === optionId);
      if (!existing) return current;
      const nextQty = direction === 'increase' ? existing.qty + 1 : existing.qty - 1;
      if (nextQty <= 0) return current.filter((item) => item.id !== optionId);

      const reservedOtherQty = getReservedQtyForProduct(current, product.productId, optionId);
      if (reservedOtherQty + nextQty > product.stockQty) {
        setError(`No se puede sobrevender. ${product.name} solo tiene ${product.stockQty} en existencias.`);
        return current;
      }

      return current.map((item) => (item.id === optionId ? { ...item, qty: nextQty } : item));
    });
  }

  function removeFromCart(optionId: string) {
    setError('');
    setScanFeedback(null);
    setParkedFeedback('');
    setCart((current) => current.filter((item) => item.id !== optionId));
  }

  function requestClearCart() {
    if (!cart.length || loading || holding) return;
    if (!window.confirm('¿Vaciar todos los artículos del carrito actual?')) return;
    resetCheckoutState();
    focusScanInput();
  }

  function findProductByScan(value: string) {
    const normalizedValue = value.trim();
    const normalizedSku = normalizedValue.toLowerCase();
    return (
      products.find((product) => product.barcode?.trim() === normalizedValue) ??
      products.find((product) => product.sku?.trim().toLowerCase() === normalizedSku) ??
      null
    );
  }

  function handleScanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = scanQuery.trim();
    setError('');
    setParkedFeedback('');
    setScanFeedback(null);
    if (!value) {
      setScanFeedback({ tone: 'error', message: 'Escanee o ingrese un código de barras o SKU y presione Enter para agregarlo.' });
      focusScanInput();
      return false;
    }
    const product = findProductByScan(value);
    if (!product) {
      setScanFeedback({ tone: 'error', message: `Ningún producto coincide con el código de barras o SKU "${value}".` });
      focusScanInput(true);
      return;
    }
    const added = addToCart(product);
    if (!added) {
      focusScanInput(true);
      return;
    }
    setScanQuery('');
    setScanFeedback({ tone: 'success', message: `${getOptionDisplayName(product)} agregado al carrito.` });
    focusScanInput();
  }

  function updatePaymentLine(lineId: string, patch: Partial<PaymentLine>) {
    setPayments((current) =>
      current.map((payment) => {
        if (payment.id !== lineId) return payment;
        const next = { ...payment, ...patch };
        if (patch.method && !requiresReferenceNumber(patch.method)) next.referenceNumber = '';
        return next;
      })
    );
  }

  function addPaymentLine() {
    const nextMethod = canAcceptCash && payments.every((payment) => payment.method !== 'Cash') ? 'Cash' : 'Card';
    setPayments((current) => [...current, createPaymentLine(nextMethod)]);
  }

  function removePaymentLine(lineId: string) {
    setPayments((current) => (current.length === 1 ? current : current.filter((payment) => payment.id !== lineId)));
  }

  function getExactAmountForLine(lineId: string) {
    const paidExcludingLine = roundCurrency(
      paymentInputs.reduce((sum, payment, index) => (payments[index]?.id === lineId ? sum : sum + payment.amount), 0)
    );
    return roundCurrency(Math.max(total - paidExcludingLine, 0));
  }

  function setPaymentLineAmount(lineId: string, amount: number) {
    updatePaymentLine(lineId, { amount: amount.toFixed(2) });
  }

  function buildSalePayload(clientRequestId: string, occurredAt: string, includePriceSnapshot: boolean) {
    return {
      clientRequestId,
      occurredAt,
      cashSessionId: activeCashSessionId,
      customerId: selectedCustomerId,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      loyaltyPointsToRedeem: Number(loyaltyPointsToRedeem),
      isCreditSale,
      creditDueDate: isCreditSale ? creditDueDate : null,
      discountAmount: manualDiscount,
      notes: notes || null,
      payments: isCreditSale
        ? []
        : paymentInputs.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            referenceNumber: payment.referenceNumber ?? null
          })),
      items: cart.map((item) => ({
        optionId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.name,
        variantLabel: item.variantLabel,
        qty: item.qty,
        priceSnapshot: includePriceSnapshot ? roundCurrency(Number(item.price)) : null
      }))
    };
  }

  function buildOfflineReceipt(
    clientRequestId: string,
    localReceiptNumber: string,
    occurredAt: string
  ): OfflineReceiptSale {
    const normalizedPayments = isCreditSale
      ? []
      : paymentInputs.map((payment, index) => ({
          id: payments[index]?.id ?? `${clientRequestId}-${index}`,
          method: payment.method,
          amount: payment.amount.toFixed(2),
          referenceNumber: payment.referenceNumber ?? null,
          createdAt: occurredAt
        }));

    return {
      id: clientRequestId,
      saleNumber: localReceiptNumber,
      receiptNumber: localReceiptNumber,
      paymentMethod: isCreditSale ? 'Customer Credit' : getSalePaymentSummaryLabel(normalizedPayments),
      cashierName,
      customerEmail: selectedCustomer?.email ?? null,
      customerBusinessName: selectedCustomer?.businessName ?? null,
      customerName: customerName || selectedCustomer?.businessName || selectedCustomer?.firstName || null,
      customerPhone: customerPhone || selectedCustomer?.phone || null,
      isCreditSale,
      creditDueDate: isCreditSale ? creditDueDate : null,
      loyaltyPointsEarned: 0,
      loyaltyPointsRedeemed: Number(loyaltyPointsToRedeem),
      loyaltyDiscountAmount: loyaltyDiscount.toFixed(2),
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: discount.toFixed(2),
      totalAmount: total.toFixed(2),
      totalPaid: (isCreditSale ? 0 : paymentSummary.totalPaid).toFixed(2),
      cashReceived: (isCreditSale ? 0 : paymentSummary.cashReceived).toFixed(2),
      changeDue: paymentSummary.changeDue.toFixed(2),
      notes,
      createdAt: occurredAt,
      payments: normalizedPayments,
      items: cart.map((item) => ({
        id: item.id,
        productName: item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name,
        qty: item.qty,
        unitPrice: Number(item.price).toFixed(2),
        lineTotal: roundCurrency(Number(item.price) * item.qty).toFixed(2)
      }))
    };
  }

  function scheduleQueueSync(delayMs = 4_000) {
    if (typeof window === 'undefined' || !window.navigator.onLine) {
      return;
    }

    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }

    retryTimerRef.current = window.setTimeout(() => {
      void syncQueuedSalesNow();
    }, delayMs);
  }

  function queueSaleForLater(clientRequestId: string, occurredAt: string, reason: string) {
    const localReceiptNumber = createOfflineReceiptNumber(new Date(occurredAt));
    const queuedSale: OfflineQueuedSale = {
      id: clientRequestId,
      shopId,
      userId,
      localReceiptNumber,
      queuedAt: new Date().toISOString(),
      status: 'PENDING',
      payload: buildSalePayload(clientRequestId, occurredAt, true),
      receipt: buildOfflineReceipt(clientRequestId, localReceiptNumber, occurredAt),
      conflicts: [],
      lastError: null
    };

    setQueuedSales((current) => [queuedSale, ...current.filter((entry) => entry.id !== queuedSale.id)]);
    setActiveReceiptId(queuedSale.id);
    setLastSyncedSale(null);
    resetCheckoutState();
    setParkedFeedback(reason);
    focusScanInput();
    scheduleQueueSync();
  }

  async function syncQueuedSalesNow() {
    if (syncInFlightRef.current) {
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const candidates = queuedSalesRef.current.filter(
      (sale) => sale.status === 'PENDING' || sale.status === 'ERROR'
    );

    if (!candidates.length) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncingQueue(true);

    for (const queuedSale of candidates) {
      setQueuedSales((current) =>
        current.map((entry) =>
          entry.id === queuedSale.id
            ? { ...entry, status: 'SYNCING', lastError: null }
            : entry
        )
      );

      try {
        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...queuedSale.payload,
            items: queuedSale.payload.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              qty: item.qty,
              priceSnapshot: item.priceSnapshot
            }))
          })
        });
        const data = await response.json().catch(() => ({ error: 'Unable to sync queued sale.' }));

        if (response.ok && data?.sale) {
          setQueuedSales((current) => current.filter((entry) => entry.id !== queuedSale.id));
          setLastSyncedSale({
            id: data.sale.id,
            saleNumber: data.sale.saleNumber,
            receiptNumber: data.sale.receiptNumber,
            localReceiptNumber: queuedSale.localReceiptNumber
          });
          setParkedFeedback(
            `La venta en cola ${queuedSale.localReceiptNumber} se sincronizó como recibo ${data.sale.receiptNumber}.`
          );
          router.refresh();
          continue;
        }

        if (response.status === 409 && data?.code === 'OFFLINE_SYNC_CONFLICT' && Array.isArray(data.conflicts)) {
          setQueuedSales((current) =>
            current.map((entry) =>
              entry.id === queuedSale.id
                ? {
                    ...entry,
                    status: 'CONFLICT',
                    conflicts: data.conflicts,
                    lastError: data.error ?? 'La venta en cola requiere revisión del cajero antes de continuar la sincronización.'
                  }
                : entry
            )
          );
          continue;
        }

        setQueuedSales((current) =>
          current.map((entry) =>
            entry.id === queuedSale.id
              ? {
                  ...entry,
                  status: 'ERROR',
                  conflicts: [],
                  lastError: data?.error ?? 'No fue posible sincronizar la venta en cola.'
                }
              : entry
          )
        );
      } catch {
        setQueuedSales((current) =>
          current.map((entry) =>
            entry.id === queuedSale.id
              ? {
                  ...entry,
                  status: 'ERROR',
                  lastError: 'Se perdió la conexión antes de que la venta en cola pudiera sincronizarse.'
                }
              : entry
          )
        );
        break;
      }
    }

    syncInFlightRef.current = false;
    setSyncingQueue(false);
  }

  const syncQueuedSalesEffect = useEffectEvent(async () => {
    await syncQueuedSalesNow();
  });
  const handleOnlineEffect = useEffectEvent(() => {
    setIsOnline(true);
    setParkedFeedback('Connection restored. Syncing queued sales now.');
    void syncQueuedSalesNow();
  });

  useEffect(() => {
    const draft: OfflineCheckoutDraft = {
      version: 1,
      updatedAt: new Date().toISOString(),
      selectedCategory,
      query,
      cart: cart.map((item) => ({
        optionId: item.id,
        qty: item.qty
      })),
      discountAmount,
      customerSearch,
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
      return;
    }

    removeLocalStorageValue(draftStorageKey);
  }, [
    cart,
    creditDueDate,
    customerName,
    customerPhone,
    customerSearch,
    discountAmount,
    draftStorageKey,
    isCreditSale,
    loyaltyPointsToRedeem,
    notes,
    payments,
    query,
    selectedCategory,
    selectedCustomerId
  ]);

  useEffect(() => {
    if (queuedSales.length) {
      writeLocalStorageValue(queueStorageKey, queuedSales);
      return;
    }

    removeLocalStorageValue(queueStorageKey);
  }, [queueStorageKey, queuedSales]);

  useEffect(() => {
    function handleOnline() {
      handleOnlineEffect();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    if (!queuedSales.some((sale) => sale.status === 'PENDING' || sale.status === 'ERROR')) {
      return;
    }

    void syncQueuedSalesEffect();
  }, [isOnline, queuedSales]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const parkedSaleId = searchParams.get('parkedSaleId');
    if (!parkedSaleId || handledSearchParamResumeRef.current === parkedSaleId) {
      return;
    }

    const parkedSale = parkedSales.find((entry) => entry.id === parkedSaleId);
    if (!parkedSale) {
      handledSearchParamResumeRef.current = parkedSaleId;
      setError('Ese registro guardado ya no está disponible o ha vencido.');
      router.replace('/checkout');
      return;
    }

    handledSearchParamResumeRef.current = parkedSaleId;
    void resumeParkedSale(parkedSale, {
      skipReplaceConfirm: true,
      clearSearchParamAfter: true
    });
  }, [parkedSales, router, searchParams]);

  async function saveCheckoutDraft(type: 'SAVED_CART' | 'QUOTE') {
    if (!cart.length) {
      setError(`Agregue al menos un artículo antes de guardar esta ${type === 'QUOTE' ? 'cotización' : 'venta en espera'}.`);
      return;
    }

    setHolding(type);
    setError('');
    setParkedFeedback('');
    try {
      const response = await fetch('/api/parked-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title:
            type === 'QUOTE'
              ? `Cotización ${selectedCustomerId ? 'de cliente' : 'general'}`
              : null,
          customerId: selectedCustomerId,
          customerName,
          customerPhone,
          discountAmount: Number(discountAmount || 0),
          notes,
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            qty: item.qty
          }))
        })
      });

      const data = await response.json().catch(() => ({ error: 'No fue posible guardar el borrador de cobro.' }));

      if (!response.ok || !data?.parkedSale) {
        setError(data?.error ?? 'No fue posible guardar el borrador de cobro.');
        return;
      }

      setParkedSales((current) => [data.parkedSale, ...current].slice(0, 20));
      setParkedFeedback(
        type === 'QUOTE'
          ? `Cotización ${data.parkedSale.quoteReference ?? ''} guardada exitosamente.`
          : 'Carrito guardado exitosamente en la lista de ventas en espera.'
      );
      clearCartState();
    } catch (error) {
      console.error(error);
      setError('No fue posible guardar el borrador de cobro.');
    } finally {
      setHolding(null);
    }
  }

  async function resumeParkedSale(parkedSale: ParkedSale, options?: { skipReplaceConfirm?: boolean; clearSearchParamAfter?: boolean }) {
    setError('');
    setParkedFeedback('');
    const missingOption = parkedSale.items.find((item) => !productMap.has(item.productVariantId ?? item.productId));
    if (missingOption) {
      setError('Uno o más artículos de este registro guardado ya no están disponibles en el catálogo activo.');
      return false;
    }
    if (cart.length && !options?.skipReplaceConfirm && !window.confirm('¿Cargar este registro guardado y reemplazar el carrito de cobro actual?')) return false;
    setResumeLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}/resume`, { method: 'POST' });
      const data = await response.json().catch(() => ({ error: 'No fue posible cargar el registro guardado.' }));
      setResumeLoadingId(null);
      if (!response.ok) {
        setError(data?.error ?? 'No fue posible cargar el registro guardado.');
        return false;
      }
      setCart(
        parkedSale.items.map((item) => {
          const option = productMap.get(item.productVariantId ?? item.productId)!;
          return { ...option, qty: item.qty };
        })
      );
      setSelectedCustomerId(parkedSale.customerId ?? null);
      setCustomerSearch(
        parkedSale.customerId
          ? getCustomerDisplayName(customers.find((customer) => customer.id === parkedSale.customerId) ?? {})
          : parkedSale.customerName ?? ''
      );
      setCustomerName(parkedSale.customerName ?? '');
      setCustomerPhone(parkedSale.customerPhone ?? '');
      setLoyaltyPointsToRedeem('0');
      setIsCreditSale(false);
      setCreditDueDate(toDateInputValue());
      setNotes(parkedSale.notes ?? '');
      setDiscountAmount(parkedSale.discountAmount);
      setScanQuery('');
      setScanFeedback(null);
      resetPayments();
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setParkedFeedback(`Se cargó ${parkedSale.type === 'QUOTE' ? 'la cotización' : 'el carrito guardado'} de ${parkedSale.cashierName}.`);
      focusScanInput();
      if (options?.clearSearchParamAfter) {
        router.replace('/checkout');
      }
      return true;
    } catch {
      setResumeLoadingId(null);
      setError('No fue posible cargar el registro guardado.');
      return false;
    }
  }

  async function cancelParkedSale(parkedSale: ParkedSale) {
    setError('');
    setParkedFeedback('');
    if (!window.confirm('¿Cancelar este registro guardado? Esto lo eliminará de la lista activa.')) return;
    setCancelLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({ error: 'No fue posible cancelar el registro guardado.' }));
      setCancelLoadingId(null);
      if (!response.ok) {
        setError(data?.error ?? 'No fue posible cancelar el registro guardado.');
        return;
      }
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setParkedFeedback('Venta en espera cancelada exitosamente.');
    } catch {
      setCancelLoadingId(null);
      setError('No fue posible cancelar el registro guardado.');
    }
  }

  function restoreQueuedSaleToCheckout(queuedSale: OfflineQueuedSale) {
    if (cart.length && !window.confirm('¿Cargar esta venta en cola en el punto de venta y reemplazar el carrito actual?')) {
      return;
    }

    const restoredCart: CartItem[] = [];
    const restoreNotes: string[] = [];

    for (const item of queuedSale.payload.items) {
      const option = productMap.get(getQueueItemOptionId(item));
      if (!option) {
        restoreNotes.push(`${item.productName} se eliminó del catálogo de la sucursal y fue omitido.`);
        continue;
      }

      const reservedQty = getReservedQtyForProduct(restoredCart, option.productId);
      const availableQty = Math.max(option.stockQty - reservedQty, 0);
      const resolvedQty = Math.min(item.qty, availableQty);

      if (resolvedQty <= 0) {
        restoreNotes.push(`${option.name} ahora está agotado y se eliminó de este carrito de recuperación.`);
        continue;
      }

      if (resolvedQty < item.qty) {
        restoreNotes.push(`${option.name} se redujo de ${item.qty} a ${resolvedQty} según las existencias actuales.`);
      }

      restoredCart.push({ ...option, qty: resolvedQty });
    }

    if (!restoredCart.length) {
      setError('No quedan artículos vendibles en esta venta en cola. Elimínela de la cola tras revisar las notas de conflicto.');
      return;
    }

    setCart(restoredCart);
    setSelectedCustomerId(queuedSale.payload.customerId);
    setCustomerSearch(
      queuedSale.payload.customerId
        ? getCustomerDisplayName(customers.find((customer) => customer.id === queuedSale.payload.customerId) ?? {})
        : queuedSale.payload.customerName ?? ''
    );
    setCustomerName(queuedSale.payload.customerName ?? '');
    setCustomerPhone(queuedSale.payload.customerPhone ?? '');
    setLoyaltyPointsToRedeem(String(queuedSale.payload.loyaltyPointsToRedeem));
    setIsCreditSale(queuedSale.payload.isCreditSale);
    setCreditDueDate(queuedSale.payload.creditDueDate ?? toDateInputValue());
    setNotes(queuedSale.payload.notes ?? '');
    setDiscountAmount(String(queuedSale.payload.discountAmount));
    setPayments(
      queuedSale.payload.isCreditSale
        ? buildInitialPaymentLines(defaultPaymentMethods, canAcceptCash)
        : queuedSale.payload.payments.map((payment) => ({
            id: crypto.randomUUID(),
            method: payment.method,
            amount: payment.amount.toFixed(2),
            referenceNumber: payment.referenceNumber ?? ''
          }))
    );
    setQueuedSales((current) => current.filter((entry) => entry.id !== queuedSale.id));
    setScanFeedback(null);
    setError('');
    setParkedFeedback(
      restoreNotes.length
        ? `La venta en cola se transfirió al punto de venta. ${restoreNotes.join(' ')}`
        : 'La venta en cola se transfirió al punto de venta para revisión del cajero.'
    );
    focusScanInput();
  }

  function removeQueuedSale(queuedSale: OfflineQueuedSale) {
    if (!window.confirm('¿Eliminar esta venta en cola del almacenamiento local sin conexión?')) {
      return;
    }

    setQueuedSales((current) => current.filter((entry) => entry.id !== queuedSale.id));
    setParkedFeedback(`Venta en cola ${queuedSale.localReceiptNumber} eliminada del almacenamiento local.`);
  }

  async function completeSale() {
    setError('');
    setParkedFeedback('');
    if (!cart.length) return setError('Por favor, agregue al menos un artículo al carrito.');
    if (discount < 0) return setError('El monto del descuento no puede ser negativo.');
    if (discount > subtotal + taxAmount) return setError('El descuento no puede exceder el total de la venta.');
    if (paymentError) return setError(paymentError);
    if (offlineCheckoutBlocked) {
      setError(
        `El cobro sin conexión está bloqueado porque la instantánea de stock de la sucursal tiene ${Math.ceil(stockSnapshotAgeMinutes)} minutos. Actualice la sucursal con conexión antes de volver a vender sin conexión.`
      );
      return;
    }

    const occurredAt = new Date().toISOString();
    const clientRequestId = createOfflineClientRequestId(shopId, userId, new Date(occurredAt));
    const livePayload = buildSalePayload(clientRequestId, occurredAt, false);

    if (!isOnline) {
      queueSaleForLater(
        clientRequestId,
        occurredAt,
        `Modo sin conexión detectado. La venta ${clientRequestId.slice(-8)} se guardó localmente y el comprobante temporal está listo para imprimir.`
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...livePayload,
          items: livePayload.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            qty: item.qty
          }))
        })
      });
      const data = await response.json().catch(() => ({ error: 'No fue posible registrar la venta.' }));
      setLoading(false);
      if (!response.ok) {
        setError(data.error ?? 'No fue posible registrar la venta.');
        return;
      }
      resetCheckoutState();
      router.push(`/print/receipt/${data.sale.id}?autoprint=1`);
      router.refresh();
    } catch {
      setLoading(false);
      queueSaleForLater(
        clientRequestId,
        occurredAt,
        'El envío de la venta falló por pérdida de conexión. La venta se guardó en la cola local y se sincronizará automáticamente al restablecerse la red.'
      );
    }
  }

  const handleCompleteSaleShortcut = useEffectEvent(() => {
    void completeSale();
  });

  const handleClearCartShortcut = useEffectEvent(() => {
    requestClearCart();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault();
        focusScanInput(true);
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === 'F9' && canCompleteSale) {
        event.preventDefault();
        handleCompleteSaleShortcut();
        return;
      }
      if (event.key === 'F4' && cart.length) {
        event.preventDefault();
        handleClearCartShortcut();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCompleteSale, cart.length]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {isOnline ? 'En línea' : 'Sin conexión'}
              </span>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                {queuedSales.length} venta(s) sin sincronizar
              </span>
              {conflictedQueuedSales.length ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                  {conflictedQueuedSales.length} conflicto(s)
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-black text-stone-950">Punto de venta listo sin conexión</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Los borradores del carrito se conservan localmente, las ventas sin conexión se encolan para su sincronización y los recibos permanecen listos para imprimir.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">En cola</div>
              <div className="mt-1 text-2xl font-black text-stone-950">{queuedSales.length}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Pendiente sinc.</div>
              <div className="mt-1 text-2xl font-black text-sky-700">{pendingQueuedSales.length + failedQueuedSales.length}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Antigüedad stock</div>
              <div className={`mt-1 text-2xl font-black ${isStockSnapshotStale ? 'text-amber-700' : 'text-emerald-700'}`}>
                {Number.isFinite(stockSnapshotAgeMinutes) ? `${Math.ceil(stockSnapshotAgeMinutes)}m` : 'Desconocido'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className={`rounded-[24px] border px-4 py-4 text-sm ${
            offlineCheckoutBlocked
              ? 'border-red-200 bg-red-50 text-red-800'
              : !isOnline && isStockSnapshotStale
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-stone-200 bg-stone-50 text-stone-700'
          }`}>
            <div className="font-semibold text-stone-900">Protección de existencias sin conexión</div>
            <div className="mt-2 leading-6">
              {offlineCheckoutBlocked
                ? `Esta sucursal está desconectada y la copia de existencias tiene más de ${offlineStockMaxAgeMinutes} minutos, por lo que la venta sin conexión está bloqueada hasta sincronizar con conexión.`
                : !isOnline && isStockSnapshotStale
                  ? `Esta sucursal está desconectada y la copia de existencias no está actualizada. Se permite el cobro con advertencia, pero las ventas en cola podrían requerir revisión al sincronizar.`
                  : `La copia de existencias actual fue capturada hace ${Math.ceil(stockSnapshotAgeMinutes)} minuto(s). El cobro sin conexión avisará o bloqueará según la configuración de la sucursal.`}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button
              type="button"
              variant="secondary"
              disabled={!queuedSales.length || syncingQueue || !isOnline}
              onClick={() => void syncQueuedSalesNow()}
            >
              {syncingQueue ? 'Sincronizando ventas...' : 'Reintentar sincronización'}
            </Button>
            {activeReceiptSale ? (
              <Button type="button" variant="secondary" onClick={() => setActiveReceiptId(activeReceiptSale.id)}>
                Ver recibo en cola
              </Button>
            ) : null}
            {lastSyncedSale ? (
              <Link href={`/print/receipt/${lastSyncedSale.id}`} className="inline-flex">
                <Button type="button" className="w-full justify-center">
                  Ver último recibo sincronizado
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        {lastSyncedSale ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            El recibo en cola {lastSyncedSale.localReceiptNumber} se sincronizó exitosamente como {lastSyncedSale.receiptNumber}.
          </div>
        ) : null}

        {queuedSales.length ? (
          <div className="mt-6 space-y-3">
            {queuedSales.map((queuedSale) => (
              <div key={queuedSale.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getQueuedSaleStatusTone(queuedSale.status)}`}>
                        {getQueuedSaleStatusLabel(queuedSale.status)}
                      </span>
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                        {queuedSale.localReceiptNumber}
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-black text-stone-950">
                      {money(queuedSale.receipt.totalAmount, currencySymbol)}
                    </div>
                    <div className="mt-1 text-sm text-stone-500">
                      En cola desde {dateTime(queuedSale.queuedAt)} / {queuedSale.receipt.items.length} línea(s)
                    </div>
                    {queuedSale.lastError ? (
                      <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {queuedSale.lastError}
                      </div>
                    ) : null}
                    {queuedSale.conflicts.length ? (
                      <div className="mt-3 space-y-2">
                        {queuedSale.conflicts.map((conflict, index) => (
                          <div key={`${queuedSale.id}-${conflict.productId}-${index}`} className="rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <div className="font-semibold text-amber-900">{conflict.productName}</div>
                            <div className="mt-1">{conflict.message}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-[240px] space-y-2">
                    <Button type="button" variant="secondary" className="w-full justify-center" onClick={() => setActiveReceiptId(queuedSale.id)}>
                      Imprimir recibo local
                    </Button>
                    {queuedSale.status !== 'SYNCING' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => restoreQueuedSaleToCheckout(queuedSale)}
                      >
                        Revisar en cobro
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      disabled={queuedSale.status === 'SYNCING' || !isOnline}
                      className="w-full justify-center"
                      onClick={() => void syncQueuedSalesNow()}
                    >
                      Reintentar sincronización
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="w-full justify-center"
                      disabled={queuedSale.status === 'SYNCING'}
                      onClick={() => removeQueuedSale(queuedSale)}
                    >
                      Eliminar venta en cola
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {activeReceiptSale ? (
        <Card>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Recibo sin conexión</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">Vista previa del recibo temporal</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                Este recibo utiliza el identificador local sin conexión {activeReceiptSale.localReceiptNumber}. Puede imprimirse hasta que la venta se sincronice y obtenga su número definitivo.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <ThermalReceipt
              sale={activeReceiptSale.receipt}
              shop={shop}
              currencySymbol={currencySymbol}
              receiptHeader={receiptHeader}
              receiptFooter={receiptFooter}
              receiptWidth={receiptWidth}
            />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="space-y-5 overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Cobro optimizado para escáner</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">Buscar productos</h2>
              <p className="mt-1 text-sm text-stone-500">Escanee un código de barras o escriba un SKU para agregar rápido, o use la búsqueda manual si es necesario.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Visibles</div><div className="mt-1 text-xl font-black text-stone-950">{filtered.length}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Líneas</div><div className="mt-1 text-xl font-black text-stone-950">{cart.length}</div></div>
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
              <form onSubmit={handleScanSubmit} className="flex gap-3">
                <Input ref={scanInputRef} placeholder="Escanear código o SKU" value={scanQuery} onChange={(event) => setScanQuery(event.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                <Button type="submit" variant="secondary" className="shrink-0">Agregar</Button>
              </form>
              <Input placeholder="Buscar por producto, variante, SKU, código de barras..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1">Enter agrega el artículo escaneado</span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1">`F2` enfoca el lector de código</span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1">Los artículos existentes incrementan su cantidad automáticamente</span>
            </div>

            {barcodeScannerNotes ? (
              <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                {barcodeScannerNotes}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedCategory('')} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${!selectedCategory ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}>Todos</button>
              {categories.map((category) => (
                <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selectedCategory === category.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}>{category.name}</button>
              ))}
            </div>

            {scanFeedback ? <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${scanFeedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{scanFeedback.message}</div> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <button key={product.id} type="button" onClick={() => { setScanFeedback(null); addToCart(product); }} className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.92))] p-4 text-left shadow-[0_18px_36px_-30px_rgba(28,25,23,0.35)] transition hover:-translate-y-1 hover:border-emerald-300">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={getOptionDisplayName(product)}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-stone-900">{product.name}</div>
                    <div className="mt-1 text-sm text-stone-500">{product.variantLabel ?? product.category?.name ?? 'Artículo estándar'}</div>
                    <div className="mt-2 text-xs text-stone-500">SKU: {product.sku ?? 'N/A'} / Código: {product.barcode ?? 'N/A'}</div>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${product.stockQty <= 0 ? 'border-red-200 bg-red-50 text-red-700' : product.stockQty <= 5 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{product.stockQty <= 0 ? 'Agotado' : product.stockQty <= 5 ? 'Bajo' : 'Disponible'}</div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Precio de venta</div><div className="mt-1 text-2xl font-black text-emerald-700">{money(product.price, currencySymbol)}</div></div>
                  <div className="text-right text-xs font-medium text-stone-500">{product.stockQty} en existencias</div>
                </div>
              </button>
            ))}
          </div>

          {!filtered.length ? (
            products.length ? (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6">
                <div className="text-sm font-semibold text-stone-900">{hasSearchFilters ? 'Ningún producto coincide con esa búsqueda.' : 'No hay productos visibles en este momento.'}</div>
                <div className="mt-2 text-sm text-stone-500">
                  {hasSearchFilters
                    ? 'Pruebe con un código de barras, SKU o un filtro de categoría más amplio.'
                    : 'El catálogo de la sucursal activa está vacío o filtrado por completo.'}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setQuery(''); setSelectedCategory(''); focusScanInput(); }}>
                    Restablecer búsqueda
                  </Button>
                  <Link href="/products" className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-700/90 bg-[linear-gradient(180deg,#059669,#047857)] px-4 text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(5,150,105,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(5,150,105,0.85)]">
                    Agregar productos
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6">
                <div className="text-sm font-semibold text-stone-900">Esta sucursal aún no cuenta con productos para la venta.</div>
                <div className="mt-2 text-sm text-stone-500">Agregue productos con código de barras o SKU primero para habilitar el flujo rápido con escáner para los cajeros.</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/products" className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-700/90 bg-[linear-gradient(180deg,#059669,#047857)] px-4 text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(5,150,105,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(5,150,105,0.85)]">
                    Crear primer producto
                  </Link>
                  <Link href="/settings" className="inline-flex h-11 items-center justify-center rounded-2xl border border-stone-200 bg-white/90 px-4 text-sm font-semibold text-stone-800 shadow-[0_12px_24px_-18px_rgba(28,25,23,0.32)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white">
                    Revisar configuración de sucursal
                  </Link>
                </div>
              </div>
            )
          ) : null}
        </Card>
        <Card className="space-y-5 xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Punto de venta</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">Resumen de cobro</h2>
              <p className="mt-1 text-sm text-stone-500">Cajero: <span className="font-semibold text-stone-700">{cashierName}</span></p>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-right"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Artículos</div><div className="text-2xl font-black text-stone-950">{itemCount}</div></div>
          </div>

          <div className="space-y-3">
            {cart.length ? cart.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.9))] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.name}</div>
                    <div className="text-sm text-stone-500">{item.variantLabel ?? 'Artículo base'}</div>
                    <div className="mt-1 text-xs text-stone-500">{money(item.price, currencySymbol)} c/u</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" className="h-10 w-10 px-0" onClick={() => updateQty(item.id, 'decrease')}>-</Button>
                    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-white px-3 font-semibold text-stone-900">{item.qty}</span>
                    <Button type="button" variant="secondary" className="h-10 w-10 px-0" onClick={() => updateQty(item.id, 'increase')}>+</Button>
                    <Button type="button" variant="ghost" className="h-10 px-3 text-xs uppercase tracking-[0.14em]" onClick={() => removeFromCart(item.id)}>Quitar</Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-[20px] border border-stone-200/80 bg-white/80 px-3 py-2.5 text-sm"><span className="text-stone-500">Total línea</span><span className="font-semibold text-stone-900">{money(Number(item.price) * item.qty, currencySymbol)}</span></div>
              </div>
            )) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6">
                <div className="text-sm font-semibold text-stone-900">Aún no hay artículos en el carrito.</div>
                <div className="mt-2 text-sm text-stone-500">Escanee un código de barras y presione Enter, elija entre las tarjetas de producto o use «F2» para enfocar el lector.</div>
              </div>
            )}
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Cliente y pago</div>
            <p className="mt-1 text-sm text-stone-500">Asigne un cliente para registrar historial, fidelidad o cuentas por cobrar.</p>
            {!canAcceptCash && !isCreditSale ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Abra una sesión de caja para aceptar pagos en efectivo. Otros medios de pago pueden procesarse con normalidad.</div> : null}

            <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
              <div className="text-sm font-semibold text-stone-900">Búsqueda de clientes</div>
              <div className="mt-3 grid gap-3">
                <Input placeholder="Buscar cliente por nombre, teléfono, correo o empresa" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {filteredCustomers.map((customer) => (
                    <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className={`rounded-full border px-3 py-2 text-sm transition ${selectedCustomerId === customer.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-white'}`}>
                      {getCustomerDisplayName(customer)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedCustomer ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-stone-900">{getCustomerDisplayName(selectedCustomer)}</div>
                      <div className="text-stone-600">{selectedCustomer.phone || 'Sin teléfono'}{selectedCustomer.email ? ` / ${selectedCustomer.email}` : ''}</div>
                      <div className="mt-1 text-xs text-stone-500">Puntos: {selectedCustomer.loyaltyBalance} / Deuda: {money(selectedCustomer.receivableBalance, currencySymbol)}</div>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => { setSelectedCustomerId(null); setCustomerSearch(''); setCustomerName(''); setCustomerPhone(''); setLoyaltyPointsToRedeem('0'); setIsCreditSale(false); }}>
                      Quitar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input placeholder="Nombre del cliente" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              <Input placeholder="Teléfono del cliente" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              <Input type="number" step="0.01" placeholder="Monto de descuento" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
              <Input placeholder="Notas de esta venta" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Input type="number" min={0} placeholder="Canjear puntos de fidelidad" value={loyaltyPointsToRedeem} onChange={(event) => setLoyaltyPointsToRedeem(event.target.value)} />
              <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                <input type="checkbox" checked={isCreditSale} onChange={(event) => setIsCreditSale(event.target.checked)} />
                Registrar como venta a crédito al cliente
              </label>
              <Input type="date" value={creditDueDate} onChange={(event) => setCreditDueDate(event.target.value)} disabled={!isCreditSale} />
            </div>

            {!isCreditSale ? <div className="mt-4 space-y-3">
              {payments.map((payment) => {
                const exactAmount = getExactAmountForLine(payment.id);
                const quickAmounts = getQuickCashAmounts(exactAmount).filter((amount) => amount !== exactAmount);
                return (
                  <div key={payment.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
                      <select className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-emerald-500" value={payment.method} onChange={(event) => updatePaymentLine(payment.id, { method: event.target.value as PaymentMethod })}>
                        {PAYMENT_METHODS.map((method) => <option key={method} value={method} disabled={method === 'Cash' && !canAcceptCash}>{method === 'Cash' ? (canAcceptCash ? 'Efectivo' : 'Efectivo (requiere apertura de caja)') : method === 'Card' ? 'Tarjeta' : method === 'E-Wallet' ? 'Billetera digital' : method === 'Bank Transfer' ? 'Transferencia bancaria' : method}</option>)}
                      </select>
                      <Input type="number" step="0.01" placeholder={payment.method === 'Cash' ? 'Efectivo recibido' : 'Monto'} value={payment.amount} onChange={(event) => updatePaymentLine(payment.id, { amount: event.target.value })} />
                      <Button type="button" variant="ghost" onClick={() => removePaymentLine(payment.id)} disabled={payments.length === 1}>Quitar</Button>
                    </div>
                    {requiresReferenceNumber(payment.method) ? <div className="mt-3"><Input placeholder={payment.method === 'Card' ? 'Nro. de referencia de tarjeta' : payment.method === 'E-Wallet' ? 'Nro. de referencia de billetera virtual' : 'Nro. de referencia de transferencia'} value={payment.referenceNumber} onChange={(event) => updatePaymentLine(payment.id, { referenceNumber: event.target.value })} /></div> : null}
                    {payment.method === 'Cash' ? <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setPaymentLineAmount(payment.id, exactAmount)}>Monto exacto</Button>{quickAmounts.map((amount) => <Button key={`${payment.id}-${amount}`} type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setPaymentLineAmount(payment.id, amount)}>{money(amount, currencySymbol)}</Button>)}</div> : null}
                  </div>
                );
              })}
              <Button type="button" variant="secondary" onClick={addPaymentLine}>Agregar línea de pago</Button>
            </div> : (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Esta venta se registrará en las cuentas por cobrar del cliente y se cancelará posteriormente en su cuenta corriente.
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Total pagado</div><div className="mt-1 text-2xl font-black text-stone-950">{money(paymentSummary.totalPaid, currencySymbol)}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Restante</div><div className={`mt-1 text-2xl font-black ${paymentSummary.remainingAmount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(paymentSummary.remainingAmount, currencySymbol)}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Efectivo recibido</div><div className="mt-1 text-2xl font-black text-stone-950">{money(paymentSummary.cashReceived, currencySymbol)}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Vuelto / Cambio</div><div className={`mt-1 text-2xl font-black ${paymentSummary.changeDue > 0 ? 'text-emerald-700' : 'text-stone-950'}`}>{money(paymentSummary.changeDue, currencySymbol)}</div></div>
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,245,244,0.96))] p-5 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>Impuesto ({taxRate}%)</span><span>{money(taxAmount, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>Descuento manual</span><span>-{money(manualDiscount, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>Descuento por puntos</span><span>-{money(loyaltyDiscount, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>{isCreditSale ? 'Por cobrar' : 'Pagado'}</span><span>{money(isCreditSale ? total : paymentSummary.totalPaid, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>Vuelto</span><span>{money(paymentSummary.changeDue, currencySymbol)}</span></div>
            <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-lg font-black text-stone-900"><span>Total</span><span>{money(total, currencySymbol)}</span></div>
            <div className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">{cart.length ? paymentError || `${itemCount} artículo(s) en ${cart.length} línea(s) listos para validación e impresión del comprobante.` : 'Agregue al menos un producto antes de finalizar la venta.'}</div>
          </div>

          {parkedFeedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{parkedFeedback}</div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="flex-1" disabled={!canCompleteSale} onClick={() => void completeSale()}>{loading ? 'Completando venta...' : !isOnline ? 'Encolar venta sin conexión' : 'Completar venta'}</Button>
            <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading || Boolean(holding)} onClick={() => void saveCheckoutDraft('SAVED_CART')}>{holding === 'SAVED_CART' ? 'Guardando...' : 'Guardar carrito'}</Button>
            <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading || Boolean(holding)} onClick={() => void saveCheckoutDraft('QUOTE')}>{holding === 'QUOTE' ? 'Guardando...' : 'Guardar cotización'}</Button>
            <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading || Boolean(holding)} onClick={requestClearCart}>Vaciar</Button>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Ventas guardadas</div>
                <h3 className="mt-2 text-xl font-black text-stone-900">Suspender y reanudar ventas</h3>
                <p className="mt-1 text-sm text-stone-500">Las ventas guardadas conservan los artículos, datos del cliente y notas hasta por 24 horas.</p>
              </div>
              <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 text-right"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Carritos y cotizaciones</div><div className="mt-1 text-2xl font-black text-stone-950">{parkedSales.length}</div></div>
            </div>
            <div className="mt-4 space-y-3">
              {parkedSales.length ? parkedSales.map((parkedSale) => (
                <div key={parkedSale.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">En espera</span>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">{parkedSale.itemCount} artículo(s)</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${parkedSale.type === 'QUOTE' ? 'border border-sky-200 bg-sky-50 text-sky-700' : 'border border-stone-200 bg-stone-50 text-stone-600'}`}>{parkedSale.type === 'QUOTE' ? 'Cotización' : 'En espera'}</span>
                      </div>
                      <div className="mt-3 text-lg font-black text-stone-950">{money(parkedSale.totalAmount, currencySymbol)}</div>
                      <div className="mt-1 text-sm text-stone-500">{parkedSale.cashierName}{parkedSale.customerName ? ` / ${parkedSale.customerName}` : ''}</div>
                      <div className="mt-2 text-xs text-stone-500">Creado: {dateTime(parkedSale.createdAt)} / Vence: {dateTime(parkedSale.expiresAt)}</div>
                      {parkedSale.quoteReference ? <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{parkedSale.quoteReference}</div> : null}
                      {parkedSale.title ? <div className="mt-2 text-sm font-semibold text-stone-700">{parkedSale.title}</div> : null}
                      {parkedSale.notes ? <div className="mt-3 rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{parkedSale.notes}</div> : null}
                    </div>
                    <div className="min-w-[220px] space-y-2">
                      <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                        {parkedSale.items.map((item) => `${item.qty}x ${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ''}`).join(', ')}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        <Button type="button" disabled={resumeLoadingId === parkedSale.id || cancelLoadingId === parkedSale.id} onClick={() => void resumeParkedSale(parkedSale)}>{resumeLoadingId === parkedSale.id ? 'Cargando...' : parkedSale.type === 'QUOTE' ? 'Cargar cotización' : 'Reanudar'}</Button>
                        <Button type="button" variant="danger" disabled={resumeLoadingId === parkedSale.id || cancelLoadingId === parkedSale.id} onClick={() => void cancelParkedSale(parkedSale)}>{cancelLoadingId === parkedSale.id ? 'Cancelando...' : 'Cancelar'}</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : <div className="rounded-[24px] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-stone-500">No hay carritos ni cotizaciones guardadas en este momento.</div>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
