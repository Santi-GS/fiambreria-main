'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money, shortDate } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/payments';
import {
  CreatePurchaseStatus,
  getPayableStatusLabel,
  getPurchaseReceivedUnitQty,
  getPurchaseRemainingUnitQty,
  getPurchaseStatusLabel,
  payableStatusTone,
  purchaseStatusTone
} from '@/lib/purchases';
import PurchaseProductPicker from '@/components/purchases/PurchaseProductPicker';
import QuickSupplierModal from '@/components/purchases/QuickSupplierModal';
import { formatStock, getPurchaseRatioToStock, isKgBaseProduct } from '@/lib/purchase-units';

type Supplier = { id: string; name: string };
type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };
type Product = {
  id: string;
  name: string;
  cost: string;
  stockQty: number;
  barcode?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  baseUnitOfMeasureId: string | null;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
};
type PurchaseItem = {
  id: string;
  productId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  productName: string;
  qty: number;
  unitCost: string;
  lineTotal: string;
};
type PurchaseReceiptItem = {
  id: string;
  purchaseItemId: string;
  productId: string;
  qtyReceived: number;
  createdAt: string;
  product: { id: string; name: string };
};
type PurchaseReceipt = {
  id: string;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
  receivedByUser: { id: string; name: string | null; email: string };
  items: PurchaseReceiptItem[];
};
type SupplierPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  paidAt: string;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string };
};
type AccountsPayableEntry = {
  id: string;
  amountDue: string;
  amountPaid: string;
  balance: string;
  status: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};
type SupplierInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: SupplierPayment[];
  payableEntry?: AccountsPayableEntry | null;
};
export type Purchase = {
  id: string;
  purchaseNumber: string;
  totalAmount: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  supplier: { name: string };
  items: PurchaseItem[];
  receipts?: PurchaseReceipt[];
  supplierInvoice?: SupplierInvoice | null;
};
type Line = {
  productId: string;
  productName: string;
  unitOfMeasureId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  qty: number;
  unitCost: number;
};
type ReceiptDraft = {
  receivedAt: string;
  notes: string;
  items: Record<string, string>;
};
type InvoiceDraft = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  notes: string;
};
type PaymentDraft = {
  method: string;
  amount: string;
  referenceNumber: string;
  paidAt: string;
};

function toDateInputValue(value = new Date()) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function isReceivable(status: string) {
  return status === 'DRAFT' || status === 'SENT' || status === 'PARTIALLY_RECEIVED';
}

function getAvailableStatusActions(status: string) {
  switch (status) {
    case 'DRAFT':
      return ['SENT', 'CANCELLED'] as const;
    case 'SENT':
      return ['DRAFT', 'CANCELLED'] as const;
    case 'PARTIALLY_RECEIVED':
      return ['CLOSED'] as const;
    case 'FULLY_RECEIVED':
      return ['CLOSED'] as const;
    default:
      return [] as const;
  }
}

function getStatusButtonLabel(status: string) {
  switch (status) {
    case 'SENT':
      return 'Marcar como pedido enviado';
    case 'DRAFT':
      return 'Volver a pendiente de envío';
    case 'CANCELLED':
      return 'Cancelar compra';
    case 'CLOSED':
      return 'Cerrar compra';
    default:
      return getPurchaseStatusLabel(status);
  }
}

function initializeReceiptDraft(purchase: Purchase): ReceiptDraft {
  return {
    receivedAt: toDateInputValue(),
    notes: '',
    items: Object.fromEntries(
      purchase.items.map((item) => [item.id, String(getPurchaseRemainingUnitQty(item))])
    )
  };
}

function initializeInvoiceDraft(purchase: Purchase): InvoiceDraft {
  return {
    invoiceNumber: purchase.supplierInvoice?.invoiceNumber ?? '',
    invoiceDate: purchase.supplierInvoice?.invoiceDate?.slice(0, 10) ?? toDateInputValue(),
    dueDate: purchase.supplierInvoice?.dueDate?.slice(0, 10) ?? toDateInputValue(),
    totalAmount: purchase.supplierInvoice?.totalAmount ?? purchase.totalAmount,
    notes: purchase.supplierInvoice?.notes ?? ''
  };
}

function initializePaymentDraft(invoice: SupplierInvoice | null | undefined): PaymentDraft {
  return {
    method: PAYMENT_METHODS[0],
    amount: invoice?.payableEntry?.balance ?? '0',
    referenceNumber: '',
    paidAt: toDateInputValue()
  };
}

export default function PurchaseManager({
  suppliers: initialSuppliers,
  products,
  units,
  purchases,
  currencySymbol
}: {
  suppliers: Supplier[];
  products: Product[];
  units: UnitOfMeasure[];
  purchases: Purchase[];
  currencySymbol: string;
}) {
  const [history, setHistory] = useState(purchases);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [status, setStatus] = useState<CreatePurchaseStatus>('FULLY_RECEIVED');
  const [historySearch, setHistorySearch] = useState('');
  const [historySupplier, setHistorySupplier] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyPayment, setHistoryPayment] = useState('');
  const [historyRange, setHistoryRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, ReceiptDraft>>({});
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, InvoiceDraft>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyPurchaseId, setBusyPurchaseId] = useState<string | null>(null);

  function getUnitOptions(product: Product) {
    const options: Array<{ unitOfMeasureId: string; unitName: string; code: string; ratioToBase: number }> = [];
    if (product.baseUnitOfMeasure) {
      options.push({
        unitOfMeasureId: product.baseUnitOfMeasure.id,
        unitName: product.baseUnitOfMeasure.name,
        code: product.baseUnitOfMeasure.code,
        ratioToBase: getPurchaseRatioToStock(product, product.baseUnitOfMeasure.id) ?? 1
      });
    }

    for (const conversion of product.uomConversions) {
      options.push({
        unitOfMeasureId: conversion.unitOfMeasureId,
        unitName: conversion.unitOfMeasure.name,
        code: conversion.unitOfMeasure.code,
        ratioToBase: getPurchaseRatioToStock(product, conversion.unitOfMeasureId) ?? conversion.ratioToBase
      });
    }

    return options;
  }

  /** Default cost of ONE purchase unit, derived from the product cost per sale unit (per kg for weighables). */
  function getDefaultUnitCost(product: Product, ratioToStock: number) {
    const saleUnitsPerPurchaseUnit = ratioToStock / (isKgBaseProduct(product) ? 1000 : 1);
    return Math.round(Number(product.cost) * saleUnitsPerPurchaseUnit * 100) / 100;
  }

  function lineAllowsDecimals(product: Product | undefined, unitCode: string) {
    return Boolean(product && (isKgBaseProduct(product) || unitCode.toUpperCase() === 'KG'));
  }
  const addedByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of lines) map[line.productId] = (map[line.productId] ?? 0) + line.qty;
    return map;
  }, [lines]);
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of products) {
      if (product.categoryId && product.categoryName) seen.set(product.categoryId, product.categoryName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const rangeStart =
      historyRange === 'today'
        ? startOfToday
        : historyRange === 'week'
          ? startOfToday - 6 * 86_400_000
          : historyRange === 'month'
            ? new Date(now.getFullYear(), now.getMonth(), 1).getTime()
            : null;

    return history.filter((purchase) => {
      if (term) {
        const haystack = [purchase.purchaseNumber, purchase.supplier.name, ...purchase.items.map((item) => item.productName)]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (historySupplier && purchase.supplier.name !== historySupplier) return false;
      if (historyStatus && purchase.status !== historyStatus) return false;
      if (historyPayment) {
        const paymentStatus = purchase.supplierInvoice?.payableEntry?.status ?? 'NO_INVOICE';
        if (paymentStatus !== historyPayment) return false;
      }
      const createdAt = new Date(purchase.createdAt).getTime();
      if (rangeStart !== null && createdAt < rangeStart) return false;
      if (historyFrom && createdAt < new Date(`${historyFrom}T00:00:00`).getTime()) return false;
      if (historyTo && createdAt > new Date(`${historyTo}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [history, historySearch, historySupplier, historyStatus, historyPayment, historyRange, historyFrom, historyTo]);
  const hasActiveFilters = Boolean(
    historySearch || historySupplier || historyStatus || historyPayment || historyRange !== 'all' || historyFrom || historyTo
  );
  function clearFilters() {
    setHistorySearch('');
    setHistorySupplier('');
    setHistoryStatus('');
    setHistoryPayment('');
    setHistoryRange('all');
    setHistoryFrom('');
    setHistoryTo('');
  }
  function describeStock(product: Product, stock: number) {
    return formatStock(stock, isKgBaseProduct(product), product.baseUnitOfMeasure?.name);
  }
  const lineTotal = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
  const canCreatePurchase = suppliers.length > 0 && products.length > 0;
  const missingSetup = [
    suppliers.length === 0 ? { href: '/suppliers', label: 'Agregar un proveedor' } : null,
    products.length === 0 ? { href: '/products', label: 'Agregar un producto' } : null
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  function replacePurchase(updatedPurchase: Purchase) {
    setHistory((currentHistory) =>
      currentHistory.map((purchase) => (purchase.id === updatedPurchase.id ? updatedPurchase : purchase))
    );
  }

  /** Tap on a product in the picker: add 1 unit (default purchase unit) or +1 if it already exists. */
  function addProductQuick(product: Product) {
    setError('');
    setSuccess('');
    const options = getUnitOptions(product);
    const unit = options.find((option) => option.unitOfMeasureId === product.uomConversions[0]?.unitOfMeasureId) ?? options[0];
    if (!unit) {
      setError(`${product.name} no tiene unidad de compra configurada.`);
      return;
    }

    setLines((currentLines) => {
      const existing = currentLines.find(
        (line) => line.productId === product.id && line.unitOfMeasureId === unit.unitOfMeasureId
      );
      if (existing) {
        return currentLines.map((line) =>
          line === existing
            ? { ...line, qty: line.qty + 1, receivedBaseQty: Math.round((line.qty + 1) * line.ratioToBase) }
            : line
        );
      }
      return [
        ...currentLines,
        {
          productId: product.id,
          productName: product.name,
          unitOfMeasureId: unit.unitOfMeasureId,
          unitName: unit.unitName,
          ratioToBase: unit.ratioToBase,
          receivedBaseQty: unit.ratioToBase,
          qty: 1,
          unitCost: getDefaultUnitCost(product, unit.ratioToBase)
        }
      ];
    });
  }

  function updateLine(index: number, patch: Partial<Pick<Line, 'qty' | 'unitCost'>>) {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        return { ...next, receivedBaseQty: Math.round(next.qty * next.ratioToBase) };
      })
    );
  }

  function changeLineUnit(index: number, unitOfMeasureId: string) {
    setLines((currentLines) => {
      const line = currentLines[index];
      const product = products.find((entry) => entry.id === line?.productId);
      const unit = product ? getUnitOptions(product).find((option) => option.unitOfMeasureId === unitOfMeasureId) : null;
      if (!line || !product || !unit) return currentLines;

      const changed = {
        ...line,
        unitOfMeasureId: unit.unitOfMeasureId,
        unitName: unit.unitName,
        ratioToBase: unit.ratioToBase,
        unitCost: getDefaultUnitCost(product, unit.ratioToBase),
        receivedBaseQty: Math.round(line.qty * unit.ratioToBase)
      };
      const duplicateIndex = currentLines.findIndex(
        (entry, entryIndex) => entryIndex !== index && entry.productId === line.productId && entry.unitOfMeasureId === unitOfMeasureId
      );
      if (duplicateIndex === -1) {
        return currentLines.map((entry, entryIndex) => (entryIndex === index ? changed : entry));
      }
      return currentLines
        .map((entry, entryIndex) =>
          entryIndex === duplicateIndex
            ? { ...entry, qty: entry.qty + changed.qty, receivedBaseQty: Math.round((entry.qty + changed.qty) * entry.ratioToBase) }
            : entry
        )
        .filter((_, entryIndex) => entryIndex !== index);
    });
  }

  function removeLine(index: number) {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  }

  async function createPurchase() {
    setError('');
    setSuccess('');

    if (!supplierId) {
      setError('Por favor, seleccione un proveedor.');
      return;
    }

    if (!lines.length) {
      setError('Agregue al menos una línea de compra.');
      return;
    }

    const invalidLine = lines.find((line) => !(line.qty > 0) || !(line.unitCost >= 0));
    if (invalidLine) {
      setError(`Revisá la cantidad y el costo de ${invalidLine.productName}.`);
      return;
    }

    setLoading(true);

    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        status,
        notes: notes || null,
        items: lines.map((line) => ({
          productId: line.productId,
          unitOfMeasureId: line.unitOfMeasureId,
          qty: line.qty,
          unitCost: line.unitCost
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo registrar la compra.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo registrar la compra.');
      return;
    }

    setHistory((currentHistory) => [data.purchase, ...currentHistory]);
    setLines([]);
    setNotes('');
    setStatus('FULLY_RECEIVED');
    setSuccess(
      status === 'FULLY_RECEIVED'
        ? 'Compra creada y recibida por completo.'
        : status === 'SENT'
          ? 'Orden de compra creada y marcada como enviada.'
          : 'Compra guardada en espera de envío.'
    );
  }

  async function updateStatus(purchaseId: string, nextStatus: string) {
    setBusyPurchaseId(purchaseId);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_STATUS', status: nextStatus })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo actualizar la compra.' }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo actualizar la compra.');
      return;
    }

    replacePurchase(data.purchase);
    setSuccess(`Compra actualizada a ${getStatusButtonLabel(nextStatus).toLowerCase()}.`);
  }

  async function receivePurchase(purchase: Purchase) {
    const draft = receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase);
    const items = purchase.items
      .map((item) => ({
        purchaseItemId: item.id,
        qtyReceived: Number(draft.items[item.id] ?? 0)
      }))
      .filter((item) => Number.isFinite(item.qtyReceived) && item.qtyReceived > 0);

    if (!items.length) {
      setError('Ingrese la cantidad de al menos un artículo antes de registrar la entrega.');
      return;
    }

    setBusyPurchaseId(purchase.id);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECEIVE',
        receivedAt: draft.receivedAt,
        notes: draft.notes || null,
        items
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo registrar la recepción.' }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo registrar la recepción.');
      return;
    }

    replacePurchase(data.purchase);
    setReceiptDrafts((current) => ({
      ...current,
      [purchase.id]: initializeReceiptDraft(data.purchase)
    }));
    setActiveReceiptId(null);
    setSuccess('Entrega recibida e inventario actualizado.');
  }

  async function saveInvoice(purchase: Purchase) {
    const draft = invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase);

    setBusyPurchaseId(purchase.id);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPSERT_INVOICE',
        invoiceNumber: draft.invoiceNumber,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        totalAmount: Number(draft.totalAmount),
        notes: draft.notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo guardar la factura del proveedor.' }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo guardar la factura del proveedor.');
      return;
    }

    replacePurchase(data.purchase);
    setInvoiceDrafts((current) => ({
      ...current,
      [purchase.id]: initializeInvoiceDraft(data.purchase)
    }));
    setActiveInvoiceId(null);
    setSuccess(purchase.supplierInvoice ? 'Factura de proveedor actualizada.' : 'Factura de proveedor registrada.');
  }

  async function recordPayment(purchase: Purchase) {
    const draft = paymentDrafts[purchase.id] ?? initializePaymentDraft(purchase.supplierInvoice);

    setBusyPurchaseId(purchase.id);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECORD_PAYMENT',
        method: draft.method,
        amount: Number(draft.amount),
        referenceNumber: draft.referenceNumber || null,
        paidAt: draft.paidAt
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo registrar el pago al proveedor.' }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo registrar el pago al proveedor.');
      return;
    }

    replacePurchase(data.purchase);
    setPaymentDrafts((current) => ({
      ...current,
      [purchase.id]: initializePaymentDraft(data.purchase.supplierInvoice)
    }));
    setActivePaymentId(null);
    setSuccess('Pago al proveedor registrado.');
  }

  const modeOptions: Array<{ value: CreatePurchaseStatus; label: string; hint: string }> = [
    { value: 'FULLY_RECEIVED', label: 'Ya llegó', hint: 'Suma el stock al guardar' },
    { value: 'SENT', label: 'Pedido enviado', hint: 'Recibís después' },
    { value: 'DRAFT', label: 'Borrador', hint: 'Sin enviar todavía' }
  ];
  const fieldClass =
    'h-12 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 text-base outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';
  const bigButton = 'h-12 px-5 text-base';

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5" role="tablist" aria-label="Secciones de compras">
        {([
          ['new', 'Cargar compra'],
          ['history', `Historial (${history.length})`]
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`h-14 rounded-xl text-base font-black transition ${
              tab === value ? 'bg-white text-emerald-700 shadow' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">{success}</div> : null}

      {tab === 'new' ? (
        <Card>
          <div id="record-purchase" className="grid gap-5">
            {/* Proveedor */}
            <div className="grid gap-2">
              <div className="text-sm font-semibold uppercase tracking-wide text-stone-500">1 · Proveedor</div>
              <div className="flex gap-2">
                <select
                  className={fieldClass}
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  aria-label="Proveedor"
                >
                  {!suppliers.length ? <option value="">Sin proveedores</option> : null}
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="secondary" className={`${bigButton} shrink-0`} onClick={() => setSupplierModalOpen(true)}>
                  + Nuevo
                </Button>
              </div>
            </div>

            {/* Estado */}
            <div className="grid gap-2">
              <div className="text-sm font-semibold uppercase tracking-wide text-stone-500">2 · ¿La mercadería ya llegó?</div>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Estado de la compra">
                {modeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={status === option.value}
                    onClick={() => setStatus(option.value)}
                    className={`min-h-14 rounded-xl border px-3 py-2 text-left transition ${
                      status === option.value
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <div className="text-base font-bold">{option.label}</div>
                    <div className={`text-xs ${status === option.value ? 'text-emerald-50' : 'text-stone-500'}`}>{option.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Productos */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-stone-500">3 · Productos</div>
                <Button type="button" className={bigButton} onClick={() => setPickerOpen(true)}>
                  + Agregar productos
                </Button>
              </div>

              {lines.length ? (
                <div className="grid gap-3">
                  {lines.map((line, index) => {
                    const lineProduct = products.find((product) => product.id === line.productId);
                    const unitOptions = lineProduct ? getUnitOptions(lineProduct) : [];
                    const currentUnit = unitOptions.find((option) => option.unitOfMeasureId === line.unitOfMeasureId);
                    const decimals = lineAllowsDecimals(lineProduct, currentUnit?.code ?? '');
                    return (
                      <div key={`${line.productId}-${line.unitOfMeasureId}`} className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-black text-stone-900">{line.productName}</div>
                            {lineProduct ? (
                              <div className="text-sm text-emerald-700">
                                Suma +{describeStock(lineProduct, line.receivedBaseQty)} (stock actual {describeStock(lineProduct, lineProduct.stockQty)})
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            aria-label={`Quitar ${line.productName}`}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-bold text-red-600 ring-1 ring-stone-200 hover:bg-red-50"
                          >
                            ✕
                          </button>
                        </div>

                        {unitOptions.length > 1 ? (
                          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Unidad de compra">
                            {unitOptions.map((option) => {
                              const active = option.unitOfMeasureId === line.unitOfMeasureId;
                              const kgPerUnit = lineProduct && isKgBaseProduct(lineProduct) ? option.ratioToBase / 1000 : null;
                              return (
                                <button
                                  key={option.unitOfMeasureId}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => changeLineUnit(index, option.unitOfMeasureId)}
                                  className={`min-h-12 rounded-xl border px-4 py-2 text-left text-base font-semibold transition ${
                                    active ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/30' : 'border-stone-300 bg-white hover:border-stone-400'
                                  }`}
                                >
                                  {option.unitName}
                                  {kgPerUnit !== null && kgPerUnit !== 1 ? (
                                    <span className="block text-xs font-normal text-stone-500">{kgPerUnit} kg c/u</span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-1 text-sm font-semibold text-stone-500">
                            Cantidad ({line.unitName.toLowerCase()})
                            <div className="flex gap-1">
                              <button
                                type="button"
                                aria-label="Restar uno"
                                onClick={() => updateLine(index, { qty: Math.max(decimals ? 0.5 : 1, line.qty - 1) })}
                                className="h-12 w-12 shrink-0 rounded-xl bg-white text-2xl font-bold ring-1 ring-stone-300 hover:bg-stone-100"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={decimals ? 0.001 : 1}
                                step={decimals ? 0.001 : 1}
                                value={line.qty === 0 ? '' : line.qty}
                                onChange={(event) => {
                                  const value = parseFloat(event.target.value);
                                  updateLine(index, { qty: Number.isFinite(value) ? value : 0 });
                                }}
                                className={`${fieldClass} text-center font-bold`}
                              />
                              <button
                                type="button"
                                aria-label="Sumar uno"
                                onClick={() => updateLine(index, { qty: line.qty + 1 })}
                                className="h-12 w-12 shrink-0 rounded-xl bg-white text-2xl font-bold ring-1 ring-stone-300 hover:bg-stone-100"
                              >
                                +
                              </button>
                            </div>
                          </label>
                          <label className="grid gap-1 text-sm font-semibold text-stone-500">
                            Costo por {line.unitName.toLowerCase()}
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              value={line.unitCost}
                              onChange={(event) => {
                                const value = parseFloat(event.target.value);
                                updateLine(index, { unitCost: Number.isFinite(value) ? value : 0 });
                              }}
                              className={fieldClass}
                            />
                          </label>
                        </div>
                        <div className="text-right text-base font-black text-stone-900">
                          Subtotal: {money(line.qty * line.unitCost, currencySymbol)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-base font-semibold text-stone-500 hover:border-emerald-400 hover:text-emerald-700"
                >
                  Tocá acá para buscar y agregar productos
                </button>
              )}
            </div>

            <textarea
              className="min-h-20 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-base text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {/* Barra fija inferior */}
          <div className="sticky bottom-0 z-20 -mx-6 -mb-6 mt-5 flex items-center justify-between gap-3 border-t border-stone-200 bg-white/95 px-6 py-3 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7">
            <div>
              <div className="text-xs font-semibold uppercase text-stone-500">{lines.length} producto(s) · Total</div>
              <div className="text-2xl font-black text-stone-950">{money(lineTotal, currencySymbol)}</div>
            </div>
            <Button onClick={createPurchase} disabled={!lines.length || loading} className="h-14 px-6 text-base">
              {loading
                ? 'Guardando…'
                : status === 'FULLY_RECEIVED'
                  ? 'Guardar y sumar al stock'
                  : status === 'SENT'
                    ? 'Guardar pedido'
                    : 'Guardar borrador'}
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === 'history' ? (
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-lg font-black text-stone-900">
            Historial de compras
            <span className="ml-2 text-sm font-semibold text-stone-500">
              {filteredHistory.length}
              {hasActiveFilters ? ` de ${history.length}` : ''}
            </span>
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" onClick={clearFilters}>Limpiar filtros</Button>
          ) : null}
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
          <input
            type="search"
            className={fieldClass}
            placeholder="Buscar por número, proveedor o producto…"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'Todo'],
              ['today', 'Hoy'],
              ['week', 'Últimos 7 días'],
              ['month', 'Este mes']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setHistoryRange(value);
                  setHistoryFrom('');
                  setHistoryTo('');
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  historyRange === value
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={fieldClass} value={historySupplier} onChange={(event) => setHistorySupplier(event.target.value)} aria-label="Proveedor">
              <option value="">Todos los proveedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
              ))}
            </select>
            <select className={fieldClass} value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)} aria-label="Estado">
              <option value="">Todos los estados</option>
              {['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED'].map((value) => (
                <option key={value} value={value}>{getPurchaseStatusLabel(value)}</option>
              ))}
            </select>
            <select className={fieldClass} value={historyPayment} onChange={(event) => setHistoryPayment(event.target.value)} aria-label="Pago">
              <option value="">Todos los pagos</option>
              <option value="NO_INVOICE">Sin factura</option>
              {['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((value) => (
                <option key={value} value={value}>{getPayableStatusLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-stone-500">
              Desde
              <input type="date" className={fieldClass} value={historyFrom} onChange={(event) => { setHistoryFrom(event.target.value); setHistoryRange('all'); }} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-stone-500">
              Hasta
              <input type="date" className={fieldClass} value={historyTo} onChange={(event) => { setHistoryTo(event.target.value); setHistoryRange('all'); }} />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          {filteredHistory.length ? (
            filteredHistory.map((purchase) => {
              const invoice = purchase.supplierInvoice ?? null;
              const outstandingBalance = Number(invoice?.payableEntry?.balance ?? 0);
              const statusActions = getAvailableStatusActions(purchase.status);

              return (
                <div key={purchase.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-stone-900">{purchase.purchaseNumber}</div>
                      <div className="text-sm text-stone-500">{purchase.supplier.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={purchaseStatusTone(purchase.status)}>{getPurchaseStatusLabel(purchase.status)}</Badge>
                        <Badge tone="blue">{purchase.items.length} línea(s)</Badge>
                        {invoice?.payableEntry ? (
                          <Badge tone={payableStatusTone(invoice.payableEntry.status)}>
                            {getPayableStatusLabel(invoice.payableEntry.status)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-stone-900">{money(purchase.totalAmount, currencySymbol)}</div>
                      <div className="text-xs text-stone-500">Creada el {dateTime(purchase.createdAt)}</div>
                      {purchase.receivedAt ? (
                        <div className="text-xs text-stone-500">Última recepción el {dateTime(purchase.receivedAt)}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-4 text-sm text-stone-700">
                    {purchase.items.map((item) => {
                      const receivedUnits = getPurchaseReceivedUnitQty(item);
                      const remainingUnits = getPurchaseRemainingUnitQty(item);

                      return (
                        <div key={item.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold text-stone-900">{item.productName}</div>
                              <div className="text-xs text-stone-500">
                                Pedido: {item.qty} {item.unitName.toLowerCase()}{item.qty === 1 ? '' : 's'} / Recibido: {receivedUnits} / Pendiente: {remainingUnits}
                              </div>

                            </div>
                            <div className="text-sm font-semibold text-stone-700">
                              {money(item.lineTotal, currencySymbol)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {purchase.notes ? (
                    <div className="mt-3 text-sm text-stone-500">Notas: {purchase.notes}</div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {statusActions.map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        type="button"
                        variant={nextStatus === 'CANCELLED' ? 'danger' : 'secondary'}
                        onClick={() => updateStatus(purchase.id, nextStatus)}
                        disabled={busyPurchaseId === purchase.id}
                      >
                        {getStatusButtonLabel(nextStatus)}
                      </Button>
                    ))}
                    {isReceivable(purchase.status) ? (
                      <Button
                        type="button"
                        onClick={() => {
                          setReceiptDrafts((current) => ({
                            ...current,
                            [purchase.id]: current[purchase.id] ?? initializeReceiptDraft(purchase)
                          }));
                          setActiveReceiptId((current) => (current === purchase.id ? null : purchase.id));
                        }}
                        disabled={busyPurchaseId === purchase.id}
                      >
                        Recibir entrega
                      </Button>
                    ) : null}
                    {purchase.status !== 'CANCELLED' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [purchase.id]: current[purchase.id] ?? initializeInvoiceDraft(purchase)
                          }));
                          setActiveInvoiceId((current) => (current === purchase.id ? null : purchase.id));
                        }}
                        disabled={busyPurchaseId === purchase.id}
                      >
                        {purchase.supplierInvoice ? 'Editar factura' : 'Agregar factura'}
                      </Button>
                    ) : null}
                    {invoice ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setPaymentDrafts((current) => ({
                            ...current,
                            [purchase.id]: current[purchase.id] ?? initializePaymentDraft(invoice)
                          }));
                          setActivePaymentId((current) => (current === purchase.id ? null : purchase.id));
                        }}
                        disabled={busyPurchaseId === purchase.id || outstandingBalance <= 0}
                      >
                        Registrar pago
                      </Button>
                    ) : null}
                  </div>

                  {activeReceiptId === purchase.id ? (
                    <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <div className="text-sm font-semibold text-stone-900">Recibir entrega</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Input
                          type="date"
                          value={(receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase)).receivedAt}
                          onChange={(event) =>
                            setReceiptDrafts((current) => ({
                              ...current,
                              [purchase.id]: {
                                ...(current[purchase.id] ?? initializeReceiptDraft(purchase)),
                                receivedAt: event.target.value
                              }
                            }))
                          }
                        />
                        <Input
                          placeholder="Notas de entrega"
                          value={(receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase)).notes}
                          onChange={(event) =>
                            setReceiptDrafts((current) => ({
                              ...current,
                              [purchase.id]: {
                                ...(current[purchase.id] ?? initializeReceiptDraft(purchase)),
                                notes: event.target.value
                              }
                            }))
                          }
                        />
                      </div>
                      <div className="mt-4 space-y-3">
                        {purchase.items.map((item) => (
                          <div key={item.id} className="grid gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 md:grid-cols-[1fr_120px] md:items-center">
                            <div>
                              <div className="font-semibold text-stone-900">{item.productName}</div>
                              <div className="text-xs text-stone-500">
                                Pendiente: {getPurchaseRemainingUnitQty(item)} {item.unitName.toLowerCase()}{getPurchaseRemainingUnitQty(item) === 1 ? '' : 's'}
                              </div>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              max={getPurchaseRemainingUnitQty(item)}
                              value={(receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase)).items[item.id] ?? ''}
                              onChange={(event) =>
                                setReceiptDrafts((current) => ({
                                  ...current,
                                  [purchase.id]: {
                                    ...(current[purchase.id] ?? initializeReceiptDraft(purchase)),
                                    items: {
                                      ...(current[purchase.id] ?? initializeReceiptDraft(purchase)).items,
                                      [item.id]: event.target.value
                                    }
                                  }
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button type="button" onClick={() => receivePurchase(purchase)} disabled={busyPurchaseId === purchase.id}>
                          {busyPurchaseId === purchase.id ? 'Guardando recepción...' : 'Guardar recepción'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setActiveReceiptId(null)}>
                          Ocultar
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">Historial de entregas</div>
                        <div className="text-xs text-stone-500">Cada entrega actualiza el inventario únicamente por lo recibido efectivamente.</div>
                      </div>
                      <div className="text-xs text-stone-500">{purchase.receipts?.length ?? 0} recepción(es)</div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {purchase.receipts?.length ? (
                        purchase.receipts.map((receipt) => (
                          <div key={receipt.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="font-semibold text-stone-900">{dateTime(receipt.receivedAt)}</div>
                                <div className="text-xs text-stone-500">
                                  Recibido por {receipt.receivedByUser.name ?? receipt.receivedByUser.email}
                                </div>
                              </div>
                              {receipt.notes ? <div className="text-sm text-stone-500">{receipt.notes}</div> : null}
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-stone-600">
                              {receipt.items.map((item) => (
                                <div key={item.id} className="flex justify-between">
                                  <span>{item.product.name}</span>
                                  <span>{item.qtyReceived} recibidos</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-stone-500">Aún no se han registrado entregas.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">Factura de proveedor y cuenta por pagar</div>
                        <div className="text-xs text-stone-500">Conserva los detalles de la factura y el saldo por pagar vinculados a esta compra.</div>
                      </div>
                      {invoice?.payableEntry ? (
                        <div className="text-right">
                          <div className="text-xs text-stone-500">Saldo pendiente</div>
                          <div className="font-black text-stone-900">{money(invoice.payableEntry.balance, currencySymbol)}</div>
                        </div>
                      ) : null}
                    </div>

                    {invoice ? (
                      <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="font-semibold text-stone-900">{invoice.invoiceNumber}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge tone={payableStatusTone(invoice.paymentStatus)}>
                                {getPayableStatusLabel(invoice.paymentStatus)}
                              </Badge>
                              <Badge tone="stone">Vence el {shortDate(invoice.dueDate)}</Badge>
                            </div>
                          </div>
                          <div className="text-right text-sm text-stone-600">
                            <div>Total: {money(invoice.totalAmount, currencySymbol)}</div>
                            <div>Pagado: {money(invoice.payableEntry?.amountPaid ?? '0', currencySymbol)}</div>
                            <div>Saldo: {money(invoice.payableEntry?.balance ?? '0', currencySymbol)}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-stone-500">
                          Fecha de factura: {shortDate(invoice.invoiceDate)}
                          {invoice.notes ? ` / ${invoice.notes}` : ''}
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="text-sm font-semibold text-stone-900">Historial de pagos</div>
                          {invoice.payments?.length ? (
                            invoice.payments.map((payment) => (
                              <div key={payment.id} className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-semibold text-stone-900">
                                    {payment.method === 'Cash' ? 'Efectivo' : payment.method === 'Card' ? 'Tarjeta' : payment.method === 'E-Wallet' ? 'Billetera digital' : payment.method === 'Bank Transfer' ? 'Transferencia bancaria' : payment.method} / {money(payment.amount, currencySymbol)}
                                  </div>
                                  <div className="text-xs text-stone-500">
                                    {dateTime(payment.paidAt)} / {payment.createdByUser.name ?? payment.createdByUser.email}
                                  </div>
                                </div>
                                <div className="text-xs text-stone-500">
                                  {payment.referenceNumber ? `Ref. ${payment.referenceNumber}` : 'Sin referencia'}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-stone-500">Aún no se han registrado pagos al proveedor.</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-stone-500">Aún no se ha registrado una factura de proveedor para esta compra.</div>
                    )}

                    {activeInvoiceId === purchase.id ? (
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            placeholder="Número de factura"
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).invoiceNumber}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  invoiceNumber: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Total de factura"
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).totalAmount}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  totalAmount: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="date"
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).invoiceDate}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  invoiceDate: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="date"
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).dueDate}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  dueDate: event.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <textarea
                          className="mt-3 min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                          placeholder="Notas de factura"
                          value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).notes}
                          onChange={(event) =>
                            setInvoiceDrafts((current) => ({
                              ...current,
                              [purchase.id]: {
                                ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                notes: event.target.value
                              }
                            }))
                          }
                        />
                        <div className="mt-4 flex gap-2">
                          <Button type="button" onClick={() => saveInvoice(purchase)} disabled={busyPurchaseId === purchase.id}>
                            {busyPurchaseId === purchase.id ? 'Guardando factura...' : 'Guardar factura'}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setActiveInvoiceId(null)}>
                            Ocultar
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {activePaymentId === purchase.id && invoice ? (
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).method}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  method: event.target.value
                                }
                              }))
                            }
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method}>
                                {method === 'Cash' ? 'Efectivo' : method === 'Card' ? 'Tarjeta' : method === 'E-Wallet' ? 'Billetera digital' : method === 'Bank Transfer' ? 'Transferencia bancaria' : method}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Monto"
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).amount}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  amount: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            placeholder="Número de referencia"
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).referenceNumber}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  referenceNumber: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="date"
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).paidAt}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  paidAt: event.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button type="button" onClick={() => recordPayment(purchase)} disabled={busyPurchaseId === purchase.id}>
                            {busyPurchaseId === purchase.id ? 'Guardando pago...' : 'Registrar pago'}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setActivePaymentId(null)}>
                            Ocultar
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-stone-500">Aún no se han registrado compras.</div>
          )}
        </div>
      </Card>
      ) : null}

      {pickerOpen ? (
        <PurchaseProductPicker
          products={products}
          categories={categories}
          currencySymbol={currencySymbol}
          addedByProduct={addedByProduct}
          onPick={(productId) => {
            const product = products.find((entry) => entry.id === productId);
            if (product) addProductQuick(product);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      {supplierModalOpen ? (
        <QuickSupplierModal
          onClose={() => setSupplierModalOpen(false)}
          onCreated={(supplier) => {
            setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)));
            setSupplierId(supplier.id);
            setSupplierModalOpen(false);
            setSuccess(`Proveedor "${supplier.name}" creado y seleccionado.`);
          }}
        />
      ) : null}
    </div>
  );
}
