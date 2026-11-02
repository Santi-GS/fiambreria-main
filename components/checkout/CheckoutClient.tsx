'use client';

import {
  type FormEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReceiptSale } from '@/components/receipts/ThermalReceipt';
import CustomerSearchModal from './CustomerSearchModal';
import ParkedSalesModal from './ParkedSalesModal';
import PaymentModal from './PaymentModal';
import PosCartTable from './PosCartTable';
import PosHeader from './PosHeader';
import ProductSearchModal from './ProductSearchModal';
import ReceiptPreviewModal from './ReceiptPreviewModal';
import WeighProductModal from './WeighProductModal';
import type {
  CartItem,
  Category,
  Customer,
  ParkedSale,
  PaymentLine,
  Product,
  ScanFeedback
} from './types';
import { getCustomerDisplayName } from '@/lib/customers';
import { money } from '@/lib/format';
import { roundCurrency } from '@/lib/inventory';
import {
  buildOfflineCheckoutDraftStorageKey,
  buildOfflineSalesQueueStorageKey,
  createOfflineClientRequestId,
  createOfflineReceiptNumber,
  readLocalStorageValue,
  removeLocalStorageValue,
  writeLocalStorageValue,
  type OfflineCheckoutDraft,
  type OfflineQueuedSale
} from '@/lib/offline-checkout';
import {
  getPaymentSummary,
  getQuickCashAmounts,
  type PaymentMethod,
  validatePaymentsForSale
} from '@/lib/payments';
import {
  getAvailableWeightedStockGrams,
  getBaseOptionId,
  getReservedDbUnitsForProduct
} from '@/lib/pos-stock';
import {
  calculateTaxBreakdown,
  sanitizeDefaultPaymentMethods,
  type TaxModeValue
} from '@/lib/shop-settings';

type WeighModalState =
  | { mode: 'add'; product: Product; openKey: string }
  | { mode: 'edit'; item: CartItem; openKey: string }
  | null;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createPaymentLine(method: PaymentMethod): PaymentLine {
  return { id: crypto.randomUUID(), method, amount: '', referenceNumber: '' };
}

function buildInitialPaymentLines(
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

function toDateInputValue(value = new Date()) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
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
    input.isCreditSale ||
    input.payments.some(
      (payment) =>
        payment.amount.trim().length > 0 || payment.referenceNumber.trim().length > 0
    )
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
  receiptShowBrandMark?: boolean;
  printerSafeMode?: boolean;
  cashDrawerKickEnabled?: boolean;
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
  stockSnapshotCapturedAt,
  shop,
  receiptHeader,
  receiptFooter,
  receiptWidth,
  receiptShowBrandMark = false,
  printerSafeMode = true,
  cashDrawerKickEnabled = false,
  initialParkedSales
}: CheckoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeParam = searchParams.get('resume');

  const draftStorageKey = useMemo(
    () => buildOfflineCheckoutDraftStorageKey(shopId, userId),
    [shopId, userId]
  );
  const queueStorageKey = useMemo(
    () => buildOfflineSalesQueueStorageKey(shopId, userId),
    [shopId, userId]
  );

  const [initialHydrated, setInitialHydrated] = useState(false);
  const hydratedStorageIdentityRef = useRef<string | null>(null);
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [queuedSales, setQueuedSales] = useState<OfflineQueuedSale[]>([]);
  const [activeOfflineQueueId, setActiveOfflineQueueId] = useState<string | null>(null);

  // Optimistic stock deductions applied immediately upon sale completion until server snapshot refreshes
  const [optimisticDeductions, setOptimisticDeductions] = useState<{
    snapshotAt: string;
    byProductId: Record<string, number>;
  }>({ snapshotAt: stockSnapshotCapturedAt, byProductId: {} });

  const activeDeductions = useMemo(
    () =>
      optimisticDeductions.snapshotAt === stockSnapshotCapturedAt
        ? optimisticDeductions.byProductId
        : {},
    [optimisticDeductions, stockSnapshotCapturedAt]
  );

  const liveProducts = useMemo(
    () =>
      products.map((product) => {
        const deducted = activeDeductions[product.productId] ?? 0;
        return deducted > 0
          ? { ...product, stockQty: Math.max(0, product.stockQty - deducted) }
          : product;
      }),
    [products, activeDeductions]
  );

  const productMap = useMemo(
    () => new Map(liveProducts.map((product) => [product.id, product])),
    [liveProducts]
  );

  // Modals state
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isParkedSalesOpen, setIsParkedSalesOpen] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [weighModalState, setWeighModalState] = useState<WeighModalState>(null);
  const [receiptPreview, setReceiptPreview] = useState<{
    sale: ReceiptSale;
    isOffline: boolean;
  } | null>(null);

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

  // Hydration effect (runs once per shop/user storage key, unaffected by background router.refresh())
  useEffect(() => {
    const storageIdentity = `${draftStorageKey}|${queueStorageKey}`;
    if (hydratedStorageIdentityRef.current === storageIdentity) {
      return;
    }

    const timer = setTimeout(() => {
      hydratedStorageIdentityRef.current = storageIdentity;
      const restored = buildInitialCheckoutPersistenceState({
        draftStorageKey,
        queueStorageKey,
        products,
        defaultPaymentMethods,
        canAcceptCash: hasActiveCashSession
      });

      setQueuedSales(restored.queuedSales);
      if (restored.queuedSales.length > 0) {
        setActiveOfflineQueueId(restored.queuedSales[0].id);
      }
      setCart(restored.cart);
      setDiscountAmount(restored.discountAmount);
      setSelectedCustomerId(restored.selectedCustomerId);
      setCustomerName(restored.customerName);
      setCustomerPhone(restored.customerPhone);
      setIsCreditSale(restored.isCreditSale);
      setCreditDueDate(restored.creditDueDate);
      setNotes(restored.notes);
      setPayments(restored.payments);
      if (restored.message) setParkedFeedback(restored.message);
      setInitialHydrated(true);
      focusScanInput();
    }, 0);

    return () => clearTimeout(timer);
  }, [
    draftStorageKey,
    queueStorageKey,
    products,
    defaultPaymentMethods,
    hasActiveCashSession
  ]);

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
  const rawSubtotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.qty,
    0
  );
  const subtotal = roundCurrency(rawSubtotal);
  const manualDiscount = Math.min(Math.max(toNumber(discountAmount), 0), subtotal);
  const discount = roundCurrency(manualDiscount);
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

  const paymentValidation = useMemo(() => {
    if (isCreditSale) {
      if (!selectedCustomerId) {
        return {
          ok: false as const,
          error: 'Seleccione un cliente para registrar una venta en cuenta corriente.'
        };
      }
      if (!creditDueDate.trim()) {
        return {
          ok: false as const,
          error: 'Indique una fecha de vencimiento para la venta a crédito.'
        };
      }
      return { ok: true as const, error: undefined };
    }

    return validatePaymentsForSale(
      total,
      payments.map((payment) => ({
        method: payment.method,
        amount: toNumber(payment.amount),
        referenceNumber: payment.referenceNumber
      }))
    );
  }, [total, isCreditSale, selectedCustomerId, creditDueDate, payments]);

  const paymentError = paymentValidation.error;
  const canCompleteSale = cart.length > 0 && paymentValidation.ok;

  // Derived stock info for WeighProductModal (add & edit modes)
  const weighModalContext = useMemo(() => {
    if (!weighModalState) return null;

    const baseId =
      weighModalState.mode === 'edit'
        ? getBaseOptionId(weighModalState.item.id)
        : weighModalState.product.id;

    const latestProduct =
      productMap.get(baseId) ??
      (weighModalState.mode === 'edit'
        ? weighModalState.item
        : weighModalState.product);

    const { availableGrams, reservedGrams } = getAvailableWeightedStockGrams(
      latestProduct.stockQty,
      cart,
      latestProduct.productId,
      weighModalState.mode === 'edit' ? weighModalState.item.id : undefined
    );

    return {
      product: latestProduct,
      mode: weighModalState.mode,
      openKey: weighModalState.openKey,
      editItemId: weighModalState.mode === 'edit' ? weighModalState.item.id : null,
      initialWeightKg:
        weighModalState.mode === 'edit' ? weighModalState.item.qty : null,
      availableGrams,
      reservedGrams
    };
  }, [weighModalState, productMap, cart]);

  // Cart actions
  const addToCart = (product: Product, quantityMultiplier = 1) => {
    const latestProduct = productMap.get(product.id) ?? product;

    // Intercept weighted products: open weigh modal instead of adding directly
    if (latestProduct.baseUnitCode === 'KG') {
      setWeighModalState({
        mode: 'add',
        product: latestProduct,
        openKey: `add-${latestProduct.id}-${Date.now()}`
      });
      return;
    }

    const qtyToAdd = Math.max(1, Math.round(quantityMultiplier > 0 ? quantityMultiplier : 1));
    setCart((current) => {
      const existingIndex = current.findIndex((item) => item.id === latestProduct.id);
      const reservedQty = getReservedDbUnitsForProduct(
        current,
        latestProduct.productId,
        false,
        latestProduct.id
      );
      const availableStock = Math.max(latestProduct.stockQty - reservedQty, 0);

      if (availableStock <= 0) {
        setScanFeedback({
          tone: 'error',
          message: `${latestProduct.name} no tiene existencias disponibles.`
        });
        return current;
      }

      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        const nextQty = existing.qty + qtyToAdd;
        if (nextQty > availableStock) {
          setScanFeedback({
            tone: 'error',
            message: `Solo hay ${availableStock} unidad(es) disponibles de ${latestProduct.name}.`
          });
          return current;
        }

        const updated = [...current];
        updated[existingIndex] = {
          ...existing,
          stockQty: latestProduct.stockQty,
          qty: nextQty
        };
        setScanFeedback({
          tone: 'success',
          message: `${latestProduct.name} actualizado (Cant.: ${nextQty}).`
        });
        return updated;
      }

      if (qtyToAdd > availableStock) {
        setScanFeedback({
          tone: 'error',
          message: `Solo hay ${availableStock} unidad(es) disponibles de ${latestProduct.name}.`
        });
        return current;
      }

      setScanFeedback({
        tone: 'success',
        message: `${latestProduct.name} agregado a la venta.`
      });
      return [{ ...latestProduct, qty: qtyToAdd }, ...current];
    });
  };

  const updateQty = (
    cartItemId: string,
    action: 'increase' | 'decrease' | 'set',
    explicitValue?: number
  ) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== cartItemId) return item;
          const latestProduct = productMap.get(getBaseOptionId(item.id)) ?? item;
          const isWeighted = latestProduct.baseUnitCode === 'KG';
          const reservedUnits = getReservedDbUnitsForProduct(
            current,
            item.productId,
            isWeighted,
            item.id
          );
          const availableStock = Math.max(latestProduct.stockQty - reservedUnits, 0);

          let nextQty = item.qty;
          if (action === 'increase') nextQty += 1;
          else if (action === 'decrease') nextQty -= 1;
          else if (action === 'set' && explicitValue !== undefined) nextQty = explicitValue;

          if (nextQty <= 0) return null;

          const requiredUnits = isWeighted ? Math.round(nextQty * 1000) : nextQty;
          if (requiredUnits > availableStock) {
            setScanFeedback({
              tone: 'error',
              message: isWeighted
                ? `No se puede superar el stock disponible (${(availableStock / 1000).toFixed(3).replace('.', ',')} Kg).`
                : `No se puede superar el stock disponible (${availableStock} unidad(es)).`
            });
            return item;
          }

          return { ...item, stockQty: latestProduct.stockQty, qty: nextQty };
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((current) => current.filter((item) => item.id !== cartItemId));
  };

  /**
   * Adds a weighted product to the cart with a fractional Kg quantity,
   * verifying stock availability in grams.
   */
  const addWeightedToCart = (product: Product, weightKg: number) => {
    const requestedGrams = Math.round(weightKg * 1000);
    if (requestedGrams <= 0) return;

    const latestProduct = productMap.get(product.id) ?? product;
    const normalizedKg = requestedGrams / 1000;

    setCart((current) => {
      const reservedGrams = getReservedDbUnitsForProduct(
        current,
        latestProduct.productId,
        true
      );
      const availableGrams = Math.max(0, latestProduct.stockQty - reservedGrams);

      if (requestedGrams > availableGrams) {
        setScanFeedback({
          tone: 'error',
          message: `Stock insuficiente para ${latestProduct.name}: quedan ${(availableGrams / 1000).toFixed(3).replace('.', ',')} Kg disponibles.`
        });
        return current;
      }

      const unitPrice = Number(latestProduct.price);
      const lineTotal = normalizedKg * unitPrice;

      setScanFeedback({
        tone: 'success',
        message: `${latestProduct.name} — ${normalizedKg.toFixed(3).replace('.', ',')} Kg (${money(lineTotal, currencySymbol)}) agregado.`
      });

      return [
        {
          ...latestProduct,
          id: `${latestProduct.id}-w-${Date.now()}`,
          qty: normalizedKg
        },
        ...current
      ];
    });
  };

  /**
   * Updates an existing weighted cart item's quantity in-place.
   */
  const updateWeightedCartItem = (cartItemId: string, weightKg: number) => {
    const requestedGrams = Math.round(weightKg * 1000);
    if (requestedGrams <= 0) return;
    const normalizedKg = requestedGrams / 1000;

    setCart((current) =>
      current.map((item) => {
        if (item.id !== cartItemId) return item;
        const latestProduct = productMap.get(getBaseOptionId(item.id)) ?? item;
        const reservedGrams = getReservedDbUnitsForProduct(
          current,
          item.productId,
          true,
          item.id
        );
        const availableGrams = Math.max(0, latestProduct.stockQty - reservedGrams);

        if (requestedGrams > availableGrams) {
          setScanFeedback({
            tone: 'error',
            message: `Stock insuficiente para ${item.name}: máximo disponible ${(availableGrams / 1000).toFixed(3).replace('.', ',')} Kg.`
          });
          return item;
        }

        const lineTotal = normalizedKg * Number(item.price);
        setScanFeedback({
          tone: 'success',
          message: `${item.name} — peso actualizado a ${normalizedKg.toFixed(3).replace('.', ',')} Kg (${money(lineTotal, currencySymbol)}).`
        });

        return {
          ...item,
          stockQty: latestProduct.stockQty,
          qty: normalizedKg
        };
      })
    );
  };

  const openEditWeightedItem = (item: CartItem) => {
    setWeighModalState({
      mode: 'edit',
      item,
      openKey: `edit-${item.id}-${Date.now()}`
    });
  };

  const recordOptimisticStockDeduction = (soldItems: CartItem[]) => {
    setOptimisticDeductions((prev) => {
      const base =
        prev.snapshotAt === stockSnapshotCapturedAt ? { ...prev.byProductId } : {};

      for (const item of soldItems) {
        const isWeighted = item.baseUnitCode === 'KG';
        const deductedUnits = isWeighted
          ? Math.round(item.qty * 1000)
          : Math.max(1, Math.round(item.qty));
        base[item.productId] = (base[item.productId] ?? 0) + deductedUnits;
      }

      return {
        snapshotAt: stockSnapshotCapturedAt,
        byProductId: base
      };
    });
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

    const matchedProduct = liveProducts.find(
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
      if (matchedProduct.baseUnitCode !== 'KG') {
        focusScanInput(true);
      }
    } else {
      setScanFeedback({
        tone: 'error',
        message: `No se encontró ningún producto con el código "${scanQuery}".`
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
    setPayments((current) => [
      ...current,
      createPaymentLine(hasActiveCashSession ? 'Cash' : 'Card')
    ]);
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
          customerName:
            customerName ||
            (selectedCustomer ? getCustomerDisplayName(selectedCustomer) : null),
          customerPhone: customerPhone || selectedCustomer?.phone || null,
          discountAmount: discount,
          notes: notes || null,
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            qty: item.qty
          }))
        })
      });

      const data = await response.json();
      setHolding(null);
      if (!response.ok) {
        setError(data.error ?? 'No fue posible guardar el carrito en espera.');
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
      setError('Error de conexión al guardar la venta en espera.');
    }
  };

  const resumeParkedSale = async (
    parkedSale: ParkedSale,
    options?: { clearSearchParamAfter?: boolean }
  ) => {
    setError('');
    setParkedFeedback('');
    setResumeLoadingId(parkedSale.id);

    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}/resume`, {
        method: 'POST'
      });
      const data = await response.json();
      setResumeLoadingId(null);

      if (!response.ok) {
        setError(data.error ?? 'No fue posible retomar la venta.');
        return false;
      }

      // Reconstruct cart from restored lines (preserving fractional Kg weights)
      const restoredCart: CartItem[] = [];
      parkedSale.items.forEach((item, index) => {
        const optionId = item.productVariantId ?? item.productId;
        const option = productMap.get(optionId);
        if (!option) return;

        if (option.baseUnitCode === 'KG') {
          const weightMatch = item.variantLabel?.match(/(\d+(?:\.\d+)?)\s*Kg$/i);
          const inferredWeight = weightMatch
            ? parseFloat(weightMatch[1])
            : Number(option.price) > 0
              ? Math.round((Number(item.lineTotal) / Number(option.price)) * 1000) /
                1000
              : item.qty;

          if (inferredWeight > 0) {
            restoredCart.push({
              ...option,
              id: `${option.id}-w-${Date.now()}-${index}`,
              qty: inferredWeight
            });
          }
        } else {
          restoredCart.push({ ...option, qty: item.qty });
        }
      });

      setCart(restoredCart);
      setSelectedCustomerId(parkedSale.customerId);
      setCustomerName(parkedSale.customerName ?? '');
      setCustomerPhone(parkedSale.customerPhone ?? '');
      setNotes(parkedSale.notes ?? '');
      setParkedSales((current) =>
        current.filter((entry) => entry.id !== parkedSale.id)
      );
      setParkedFeedback(
        `Se cargó ${parkedSale.type === 'QUOTE' ? 'la cotización' : 'el carrito en espera'}.`
      );
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
    if (
      !window.confirm(
        '¿Cancelar este registro guardado? Se eliminará de la lista activa.'
      )
    ) {
      return;
    }
    setCancelLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}`, {
        method: 'DELETE'
      });
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
    if (!cart.length) {
      return setError('Por favor agregue productos al carrito.');
    }
    if (paymentError) {
      return setError(paymentError);
    }

    const occurredAt = new Date().toISOString();
    const clientRequestId = createOfflineClientRequestId(
      shopId,
      userId,
      new Date(occurredAt)
    );
    const resolvedCustomerName =
      customerName ||
      (selectedCustomer ? getCustomerDisplayName(selectedCustomer) : null);
    const resolvedCustomerPhone = customerPhone || selectedCustomer?.phone || null;

    const salePayload = {
      clientRequestId,
      shopId,
      customerId: selectedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: discount.toFixed(2),
      totalAmount: total.toFixed(2),
      changeDue: paymentSummary.changeDue.toFixed(2),
      paymentMethod: isCreditSale ? 'Credit' : (payments[0]?.method ?? 'Cash'),
      isCreditSale,
      creditDueDate: isCreditSale ? creditDueDate : null,
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
      // Enqueue offline & show compact receipt preview modal immediately
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
          customerName: resolvedCustomerName,
          customerPhone: resolvedCustomerPhone,
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
            optionId: getBaseOptionId(item.id),
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
          paymentMethod: isCreditSale
            ? 'Credit'
            : payments.length > 1
              ? 'Split'
              : (payments[0]?.method ?? 'Cash'),
          cashierName,
          customerName: resolvedCustomerName,
          customerPhone: resolvedCustomerPhone,
          customerBusinessName: selectedCustomer?.businessName ?? null,
          customerEmail: selectedCustomer?.email ?? null,
          isCreditSale,
          creditDueDate: isCreditSale ? creditDueDate : null,
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
          items: cart.map((item) => {
            const isKg = item.baseUnitCode === 'KG' || !Number.isInteger(item.qty);
            const lineTotalNum = roundCurrency(Number(item.price) * item.qty);
            return {
              id: `item-${item.id}`,
              productName: isKg
                ? `${item.name} (${item.qty.toFixed(3)} Kg)`
                : item.name,
              qty: isKg ? 1 : item.qty,
              unitPrice: isKg ? lineTotalNum.toFixed(2) : item.price,
              lineTotal: lineTotalNum.toFixed(2)
            };
          })
        }
      };

      const soldSnapshot = [...cart];
      recordOptimisticStockDeduction(soldSnapshot);
      setQueuedSales((cur) => [offlineSale, ...cur]);
      setActiveOfflineQueueId(offlineSale.id);
      resetCheckoutState();
      setReceiptPreview({ sale: offlineSale.receipt, isOffline: true });
      setParkedFeedback(
        `Venta ${localReceiptNumber} guardada en cola sin conexión.`
      );
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

      const serverPayments: ReceiptSale['payments'] = Array.isArray(
        data.sale?.payments
      )
        ? data.sale.payments.map(
            (p: {
              id: string;
              method: string;
              amount: string | number;
              referenceNumber?: string | null;
              createdAt?: string;
            }) => ({
              id: p.id,
              method: p.method,
              amount: String(p.amount),
              referenceNumber: p.referenceNumber ?? null,
              createdAt: p.createdAt ?? data.sale.createdAt
            })
          )
        : isCreditSale
          ? []
          : payments.map((p) => ({
              id: p.id,
              method: p.method,
              amount: toNumber(p.amount).toFixed(2),
              referenceNumber: p.referenceNumber || null,
              createdAt: data.sale.createdAt
            }));

      const completedReceipt: ReceiptSale = {
        id: data.sale.id,
        saleNumber: data.sale.saleNumber,
        receiptNumber: data.sale.receiptNumber,
        paymentMethod: data.sale.paymentMethod,
        cashierName: data.sale.cashierName ?? cashierName,
        customerName: data.sale.customerName ?? resolvedCustomerName,
        customerPhone: data.sale.customerPhone ?? resolvedCustomerPhone,
        customerBusinessName: selectedCustomer?.businessName ?? null,
        customerEmail: selectedCustomer?.email ?? null,
        isCreditSale: Boolean(data.sale.isCreditSale),
        creditDueDate: isCreditSale ? creditDueDate : null,
        subtotal: String(data.sale.subtotal),
        taxAmount: String(data.sale.taxAmount),
        discountAmount: String(data.sale.discountAmount),
        totalAmount: String(data.sale.totalAmount),
        totalPaid: paymentSummary.totalPaid.toFixed(2),
        cashReceived: paymentSummary.cashReceived.toFixed(2),
        changeDue: String(data.sale.changeDue),
        notes: data.sale.notes ?? null,
        createdAt: data.sale.createdAt,
        payments: serverPayments,
        items: (data.sale.items ?? []).map(
          (item: {
            id: string;
            productName: string;
            qty: number;
            unitPrice: string | number;
            lineTotal: string | number;
          }) => ({
            id: item.id,
            productName: item.productName,
            qty: item.qty,
            unitPrice: String(item.unitPrice),
            lineTotal: String(item.lineTotal)
          })
        )
      };

      const soldSnapshot = [...cart];
      recordOptimisticStockDeduction(soldSnapshot);
      resetCheckoutState();
      setReceiptPreview({ sale: completedReceipt, isOffline: false });
      router.refresh();
    } catch {
      setLoading(false);
      setError('Error de conexión al registrar la venta en el servidor.');
    }
  };

  // Keyboard Shortcuts
  const hasAnyModalOpen =
    isProductSearchOpen ||
    isPaymentOpen ||
    isParkedSalesOpen ||
    isCustomerSearchOpen ||
    weighModalState !== null ||
    receiptPreview !== null;

  const handleOpenProductSearchEvent = useEffectEvent(() => {
    if (receiptPreview || weighModalState) return;
    setIsProductSearchOpen(true);
  });

  const handleOpenPaymentEvent = useEffectEvent(() => {
    if (receiptPreview || weighModalState) return;
    if (isPaymentOpen && canCompleteSale && !loading) {
      void completeSale();
      return;
    }
    if (cart.length > 0) setIsPaymentOpen(true);
  });

  const handleOpenCustomerEvent = useEffectEvent(() => {
    if (receiptPreview || weighModalState) return;
    setIsCustomerSearchOpen(true);
  });

  const handleOpenParkedSalesEvent = useEffectEvent(() => {
    if (receiptPreview || weighModalState) return;
    setIsParkedSalesOpen(true);
  });

  const handleNewSaleEvent = useEffectEvent(() => {
    if (receiptPreview) {
      setReceiptPreview(null);
      focusScanInput();
      return;
    }
    requestClearCart();
  });

  const handleEscapeEvent = useEffectEvent(() => {
    // Close topmost modal first
    if (weighModalState) {
      setWeighModalState(null);
      focusScanInput();
      return;
    }
    if (receiptPreview) {
      setReceiptPreview(null);
      focusScanInput();
      return;
    }
    if (isCustomerSearchOpen) {
      setIsCustomerSearchOpen(false);
      if (!isPaymentOpen) focusScanInput();
      return;
    }
    setIsProductSearchOpen(false);
    setIsPaymentOpen(false);
    setIsParkedSalesOpen(false);
    focusScanInput();
  });

  const hasAnyModalOpenEvent = useEffectEvent(() => hasAnyModalOpen);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Escape closes topmost modal and focuses scanner
      if (event.key === 'Escape') {
        event.preventDefault();
        handleEscapeEvent();
        return;
      }

      // Hotkey: Ctrl+B or Alt+B (Buscar producto)
      if (
        (event.ctrlKey || event.altKey) &&
        (event.key === 'b' || event.key === 'B')
      ) {
        event.preventDefault();
        handleOpenProductSearchEvent();
        return;
      }

      // Hotkey: Ctrl+Enter or Alt+C (Cobrar / Confirmar cobro)
      if (
        (event.ctrlKey && event.key === 'Enter') ||
        (event.altKey && (event.key === 'c' || event.key === 'C'))
      ) {
        event.preventDefault();
        handleOpenPaymentEvent();
        return;
      }

      // Hotkey: Ctrl+K or Alt+U (Buscar cliente)
      if (
        (event.ctrlKey && (event.key === 'k' || event.key === 'K')) ||
        (event.altKey && (event.key === 'u' || event.key === 'U'))
      ) {
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

      // Single-key shortcuts only when no modal is open and not typing in an input
      if (hasAnyModalOpenEvent() || isTypingTarget(event.target)) return;

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

  // Display scale mode for 11" 2560x1600 tablets and high-density screens
  const [displayScale, setDisplayScale] = useState<'normal' | 'large' | 'xlarge'>(
    'normal'
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('vertexpos_display_scale');
        if (saved === 'normal' || saved === 'large' || saved === 'xlarge') {
          setDisplayScale(saved);
          return;
        }
        if (
          window.screen.width >= 2000 ||
          (window.screen.width >= 1200 && (window.devicePixelRatio ?? 1) >= 1.5)
        ) {
          setDisplayScale('large');
        }
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleDisplayScaleChange = (scale: 'normal' | 'large' | 'xlarge') => {
    setDisplayScale(scale);
    try {
      localStorage.setItem('vertexpos_display_scale', scale);
    } catch {}
  };

  const scaleClass =
    displayScale === 'large'
      ? 'pos-scale-large'
      : displayScale === 'xlarge'
        ? 'pos-scale-xlarge'
        : 'pos-scale-normal';

  const latestOfflineSale = useMemo(
    () =>
      queuedSales.find((item) => item.id === activeOfflineQueueId) ??
      queuedSales[0] ??
      null,
    [queuedSales, activeOfflineQueueId]
  );

  return (
    <div className={`space-y-4 transition-all duration-150 ${scaleClass}`}>
      {/* Offline Status & Notice Bar if any */}
      {!isOnline || queuedSales.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className="font-bold">
              {isOnline ? 'Terminal en línea' : 'Modo sin conexión activado'}
            </span>
            <span>• {queuedSales.length} venta(s) guardada(s) en cola local</span>
          </div>

          <div className="flex items-center gap-2">
            {latestOfflineSale ? (
              <button
                type="button"
                onClick={() =>
                  setReceiptPreview({
                    sale: latestOfflineSale.receipt,
                    isOffline: true
                  })
                }
                className="font-bold underline hover:text-amber-950"
              >
                Ver ticket temporal ({latestOfflineSale.localReceiptNumber})
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
        displayScale={displayScale}
        onDisplayScaleChange={handleDisplayScaleChange}
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
        onEditWeightedItem={openEditWeightedItem}
        onRemoveItem={removeFromCart}
        onOpenProductSearch={() => setIsProductSearchOpen(true)}
      />

      {/* Popups & Modals */}
      <ProductSearchModal
        isOpen={isProductSearchOpen}
        onClose={() => {
          setIsProductSearchOpen(false);
          focusScanInput();
        }}
        products={liveProducts}
        categories={categories}
        currencySymbol={currencySymbol}
        onSelectProduct={(product) => {
          const parsedQty = parseFloat(scanQty);
          const qtyMultiplier = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
          addToCart(product, qtyMultiplier);
          setScanQty('1');
          if (product.baseUnitCode !== 'KG') {
            focusScanInput();
          }
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
        onOpenCustomerSearch={() => setIsCustomerSearchOpen(true)}
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
          if (!isPaymentOpen) {
            focusScanInput();
          }
        }}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        currencySymbol={currencySymbol}
        onSelectCustomer={(c) => {
          setSelectedCustomerId(c?.id ?? null);
          if (!isPaymentOpen) {
            focusScanInput();
          }
        }}
      />

      <WeighProductModal
        isOpen={weighModalContext !== null}
        onClose={() => {
          setWeighModalState(null);
          focusScanInput();
        }}
        product={weighModalContext?.product ?? null}
        currencySymbol={currencySymbol}
        availableStockGrams={weighModalContext?.availableGrams ?? 0}
        reservedInCartGrams={weighModalContext?.reservedGrams ?? 0}
        initialWeightKg={weighModalContext?.initialWeightKg ?? null}
        mode={weighModalContext?.mode ?? 'add'}
        modalKey={weighModalContext?.openKey}
        onConfirm={(product, weightKg) => {
          if (weighModalContext?.mode === 'edit' && weighModalContext.editItemId) {
            updateWeightedCartItem(weighModalContext.editItemId, weightKg);
          } else {
            addWeightedToCart(product, weightKg);
          }
          setWeighModalState(null);
          focusScanInput();
        }}
      />

      <ReceiptPreviewModal
        isOpen={receiptPreview !== null}
        onClose={() => {
          setReceiptPreview(null);
          focusScanInput();
        }}
        sale={receiptPreview?.sale ?? null}
        shop={shop}
        currencySymbol={currencySymbol}
        receiptHeader={receiptHeader}
        receiptFooter={receiptFooter}
        receiptWidth={receiptWidth}
        receiptShowBrandMark={receiptShowBrandMark}
        printerSafeMode={printerSafeMode}
        cashDrawerKickEnabled={cashDrawerKickEnabled}
        isOfflineReceipt={receiptPreview?.isOffline ?? false}
      />
    </div>
  );
}
