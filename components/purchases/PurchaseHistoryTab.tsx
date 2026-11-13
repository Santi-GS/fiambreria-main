'use client';

import type { Dispatch, SetStateAction } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money, shortDate } from '@/lib/format';
import { getPaymentMethodLabel, PAYMENT_METHODS } from '@/lib/payments';
import {
  getPayableStatusLabel,
  getPurchaseReceivedUnitQty,
  getPurchaseRemainingUnitQty,
  getPurchaseStatusLabel,
  payableStatusTone,
  purchaseStatusTone
} from '@/lib/purchases';
import type {
  InvoiceDraft,
  PaymentDraft,
  Purchase,
  ReceiptDraft,
  Supplier,
  SupplierInvoice
} from './types';

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
    case 'FULLY_RECEIVED':
      return ['CLOSED'] as const;
    default:
      return [] as const;
  }
}

type HistoryRange = 'all' | 'today' | 'week' | 'month';

export default function PurchaseHistoryTab({
  history,
  filteredHistory,
  suppliers,
  currencySymbol,
  fieldClass,
  historySearch,
  setHistorySearch,
  historyRange,
  setHistoryRange,
  historySupplier,
  setHistorySupplier,
  historyStatus,
  setHistoryStatus,
  historyPayment,
  setHistoryPayment,
  historyFrom,
  setHistoryFrom,
  historyTo,
  setHistoryTo,
  hasActiveFilters,
  clearFilters,
  busyPurchaseId,
  activeReceiptId,
  setActiveReceiptId,
  activeInvoiceId,
  setActiveInvoiceId,
  activePaymentId,
  setActivePaymentId,
  receiptDrafts,
  setReceiptDrafts,
  invoiceDrafts,
  setInvoiceDrafts,
  paymentDrafts,
  setPaymentDrafts,
  initializeReceiptDraft,
  initializeInvoiceDraft,
  initializePaymentDraft,
  getStatusButtonLabel,
  updateStatus,
  receivePurchase,
  saveInvoice,
  recordPayment
}: {
  history: Purchase[];
  filteredHistory: Purchase[];
  suppliers: Supplier[];
  currencySymbol: string;
  fieldClass: string;
  historySearch: string;
  setHistorySearch: (value: string) => void;
  historyRange: HistoryRange;
  setHistoryRange: (value: HistoryRange) => void;
  historySupplier: string;
  setHistorySupplier: (value: string) => void;
  historyStatus: string;
  setHistoryStatus: (value: string) => void;
  historyPayment: string;
  setHistoryPayment: (value: string) => void;
  historyFrom: string;
  setHistoryFrom: (value: string) => void;
  historyTo: string;
  setHistoryTo: (value: string) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  busyPurchaseId: string | null;
  activeReceiptId: string | null;
  setActiveReceiptId: Dispatch<SetStateAction<string | null>>;
  activeInvoiceId: string | null;
  setActiveInvoiceId: Dispatch<SetStateAction<string | null>>;
  activePaymentId: string | null;
  setActivePaymentId: Dispatch<SetStateAction<string | null>>;
  receiptDrafts: Record<string, ReceiptDraft>;
  setReceiptDrafts: Dispatch<SetStateAction<Record<string, ReceiptDraft>>>;
  invoiceDrafts: Record<string, InvoiceDraft>;
  setInvoiceDrafts: Dispatch<SetStateAction<Record<string, InvoiceDraft>>>;
  paymentDrafts: Record<string, PaymentDraft>;
  setPaymentDrafts: Dispatch<SetStateAction<Record<string, PaymentDraft>>>;
  initializeReceiptDraft: (purchase: Purchase) => ReceiptDraft;
  initializeInvoiceDraft: (purchase: Purchase) => InvoiceDraft;
  initializePaymentDraft: (invoice: SupplierInvoice | null | undefined) => PaymentDraft;
  getStatusButtonLabel: (status: string) => string;
  updateStatus: (purchaseId: string, nextStatus: 'DRAFT' | 'SENT' | 'CANCELLED' | 'CLOSED') => Promise<void>;
  receivePurchase: (purchase: Purchase) => Promise<void>;
  saveInvoice: (purchase: Purchase) => Promise<void>;
  recordPayment: (purchase: Purchase) => Promise<void>;
}) {
  return (
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
            const receiptDraft = receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase);
            const invoiceDraft = invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase);
            const paymentDraft = paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice);

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
                        value={receiptDraft.receivedAt}
                        onChange={(event) =>
                          setReceiptDrafts((current) => ({
                            ...current,
                            [purchase.id]: { ...receiptDraft, receivedAt: event.target.value }
                          }))
                        }
                      />
                      <Input
                        placeholder="Notas de entrega"
                        value={receiptDraft.notes}
                        onChange={(event) =>
                          setReceiptDrafts((current) => ({
                            ...current,
                            [purchase.id]: { ...receiptDraft, notes: event.target.value }
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
                            value={receiptDraft.items[item.id] ?? ''}
                            onChange={(event) =>
                              setReceiptDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...receiptDraft,
                                  items: { ...receiptDraft.items, [item.id]: event.target.value }
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
                                  {getPaymentMethodLabel(payment.method)} / {money(payment.amount, currencySymbol)}
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
                          value={invoiceDraft.invoiceNumber}
                          onChange={(event) =>
                            setInvoiceDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...invoiceDraft, invoiceNumber: event.target.value }
                            }))
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Total de factura"
                          value={invoiceDraft.totalAmount}
                          onChange={(event) =>
                            setInvoiceDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...invoiceDraft, totalAmount: event.target.value }
                            }))
                          }
                        />
                        <Input
                          type="date"
                          value={invoiceDraft.invoiceDate}
                          onChange={(event) =>
                            setInvoiceDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...invoiceDraft, invoiceDate: event.target.value }
                            }))
                          }
                        />
                        <Input
                          type="date"
                          value={invoiceDraft.dueDate}
                          onChange={(event) =>
                            setInvoiceDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...invoiceDraft, dueDate: event.target.value }
                            }))
                          }
                        />
                      </div>
                      <textarea
                        className="mt-3 min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                        placeholder="Notas de factura"
                        value={invoiceDraft.notes}
                        onChange={(event) =>
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [purchase.id]: { ...invoiceDraft, notes: event.target.value }
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
                          value={paymentDraft.method}
                          onChange={(event) =>
                            setPaymentDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...paymentDraft, method: event.target.value }
                            }))
                          }
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {getPaymentMethodLabel(method)}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Monto"
                          value={paymentDraft.amount}
                          onChange={(event) =>
                            setPaymentDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...paymentDraft, amount: event.target.value }
                            }))
                          }
                        />
                        <Input
                          placeholder="Número de referencia"
                          value={paymentDraft.referenceNumber}
                          onChange={(event) =>
                            setPaymentDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...paymentDraft, referenceNumber: event.target.value }
                            }))
                          }
                        />
                        <Input
                          type="date"
                          value={paymentDraft.paidAt}
                          onChange={(event) =>
                            setPaymentDrafts((current) => ({
                              ...current,
                              [purchase.id]: { ...paymentDraft, paidAt: event.target.value }
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
  );
}
