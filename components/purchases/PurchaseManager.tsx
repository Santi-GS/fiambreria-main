'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatDateInputValue, money } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/payments';
import {
  CreatePurchaseStatus,
  getPurchaseRemainingUnitQty,
  getPurchaseStatusLabel
} from '@/lib/purchases';
import PurchaseHistoryTab from '@/components/purchases/PurchaseHistoryTab';
import PurchaseProductPicker from '@/components/purchases/PurchaseProductPicker';
import QuickSupplierModal from '@/components/purchases/QuickSupplierModal';
import {
  type InvoiceDraft,
  type Line,
  type PaymentDraft,
  type Product,
  type Purchase,
  type ReceiptDraft,
  type Supplier,
  type SupplierInvoice,
  type UnitOfMeasure
} from '@/components/purchases/types';
import { formatStock, getPurchaseRatioToStock, isKgBaseProduct } from '@/lib/purchase-units';

export type { Purchase };

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
    receivedAt: formatDateInputValue(),
    notes: '',
    items: Object.fromEntries(
      purchase.items.map((item) => [item.id, String(getPurchaseRemainingUnitQty(item))])
    )
  };
}

function initializeInvoiceDraft(purchase: Purchase): InvoiceDraft {
  return {
    invoiceNumber: purchase.supplierInvoice?.invoiceNumber ?? '',
    invoiceDate: purchase.supplierInvoice?.invoiceDate?.slice(0, 10) ?? formatDateInputValue(),
    dueDate: purchase.supplierInvoice?.dueDate?.slice(0, 10) ?? formatDateInputValue(),
    totalAmount: purchase.supplierInvoice?.totalAmount ?? purchase.totalAmount,
    notes: purchase.supplierInvoice?.notes ?? ''
  };
}

function initializePaymentDraft(invoice: SupplierInvoice | null | undefined): PaymentDraft {
  return {
    method: PAYMENT_METHODS[0],
    amount: invoice?.payableEntry?.balance ?? '0',
    referenceNumber: '',
    paidAt: formatDateInputValue()
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
        <PurchaseHistoryTab
          history={history}
          filteredHistory={filteredHistory}
          suppliers={suppliers}
          currencySymbol={currencySymbol}
          fieldClass={fieldClass}
          historySearch={historySearch}
          setHistorySearch={setHistorySearch}
          historyRange={historyRange}
          setHistoryRange={setHistoryRange}
          historySupplier={historySupplier}
          setHistorySupplier={setHistorySupplier}
          historyStatus={historyStatus}
          setHistoryStatus={setHistoryStatus}
          historyPayment={historyPayment}
          setHistoryPayment={setHistoryPayment}
          historyFrom={historyFrom}
          setHistoryFrom={setHistoryFrom}
          historyTo={historyTo}
          setHistoryTo={setHistoryTo}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          busyPurchaseId={busyPurchaseId}
          activeReceiptId={activeReceiptId}
          setActiveReceiptId={setActiveReceiptId}
          activeInvoiceId={activeInvoiceId}
          setActiveInvoiceId={setActiveInvoiceId}
          activePaymentId={activePaymentId}
          setActivePaymentId={setActivePaymentId}
          receiptDrafts={receiptDrafts}
          setReceiptDrafts={setReceiptDrafts}
          invoiceDrafts={invoiceDrafts}
          setInvoiceDrafts={setInvoiceDrafts}
          paymentDrafts={paymentDrafts}
          setPaymentDrafts={setPaymentDrafts}
          initializeReceiptDraft={initializeReceiptDraft}
          initializeInvoiceDraft={initializeInvoiceDraft}
          initializePaymentDraft={initializePaymentDraft}
          getStatusButtonLabel={getStatusButtonLabel}
          updateStatus={updateStatus}
          receivePurchase={receivePurchase}
          saveInvoice={saveInvoice}
          recordPayment={recordPayment}
        />
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
