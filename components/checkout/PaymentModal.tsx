'use client';

import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { money } from '@/lib/format';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  requiresReferenceNumber
} from '@/lib/payments';
import type { Customer, PaymentLine } from './types';

type PaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  manualDiscount: number;
  discountAmount: string;
  onDiscountAmountChange: (value: string) => void;
  loyaltyDiscount: number;
  loyaltyPointsToRedeem: string;
  onLoyaltyPointsChange: (value: string) => void;
  total: number;
  payments: PaymentLine[];
  onUpdatePaymentLine: (id: string, updates: Partial<PaymentLine>) => void;
  onAddPaymentLine: () => void;
  onRemovePaymentLine: (id: string) => void;
  onSetPaymentLineAmount: (id: string, amount: number) => void;
  canAcceptCash: boolean;
  isCreditSale: boolean;
  onIsCreditSaleChange: (value: boolean) => void;
  creditDueDate: string;
  onCreditDueDateChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  selectedCustomer: Customer | null;
  paymentSummary: {
    totalPaid: number;
    remainingAmount: number;
    changeDue: number;
    cashReceived: number;
  };
  getQuickCashAmounts: (exactAmount: number) => number[];
  getExactAmountForLine: (lineId: string) => number;
  paymentError: string | null | undefined;
  loading: boolean;
  isOnline: boolean;
  canCompleteSale: boolean;
  onCompleteSale: () => Promise<void>;
};

export default function PaymentModal({
  isOpen,
  onClose,
  currencySymbol,
  subtotal,
  taxRate,
  taxAmount,
  manualDiscount,
  discountAmount,
  onDiscountAmountChange,
  loyaltyDiscount,
  loyaltyPointsToRedeem,
  onLoyaltyPointsChange,
  total,
  payments,
  onUpdatePaymentLine,
  onAddPaymentLine,
  onRemovePaymentLine,
  onSetPaymentLineAmount,
  canAcceptCash,
  isCreditSale,
  onIsCreditSaleChange,
  creditDueDate,
  onCreditDueDateChange,
  notes,
  onNotesChange,
  selectedCustomer,
  paymentSummary,
  getQuickCashAmounts,
  getExactAmountForLine,
  paymentError,
  loading,
  isOnline,
  canCompleteSale,
  onCompleteSale
}: PaymentModalProps) {
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-set the first cash line to the exact total amount if it was empty
      if (payments.length === 1 && payments[0].method === 'Cash' && (!payments[0].amount || payments[0].amount === '0')) {
        onSetPaymentLineAmount(payments[0].id, total);
      }
    }
  }, [isOpen, payments, total, onSetPaymentLineAmount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        ref={modalContainerRef}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-stone-900">Cobro y Facturación</h3>
              <p className="text-xs text-stone-500">
                Cliente: <span className="font-bold text-stone-700">{selectedCustomer?.businessName || selectedCustomer?.firstName || 'Consumidor Final'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
            title="Cerrar [Escape]"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary Box & Total */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Breakdown card */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 text-xs text-stone-600 space-y-1.5">
              <div className="flex justify-between font-medium">
                <span>Subtotal</span>
                <span>{money(subtotal, currencySymbol)}</span>
              </div>
              {taxAmount > 0 ? (
                <div className="flex justify-between font-medium">
                  <span>Impuestos ({taxRate}%)</span>
                  <span>{money(taxAmount, currencySymbol)}</span>
                </div>
              ) : null}
              {manualDiscount > 0 ? (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Descuento</span>
                  <span>-{money(manualDiscount, currencySymbol)}</span>
                </div>
              ) : null}
              {loyaltyDiscount > 0 ? (
                <div className="flex justify-between font-bold text-sky-700">
                  <span>Puntos de fidelidad</span>
                  <span>-{money(loyaltyDiscount, currencySymbol)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-stone-200 pt-1.5 text-base font-black text-stone-900">
                <span>TOTAL A COBRAR</span>
                <span>{money(total, currencySymbol)}</span>
              </div>
            </div>

            {/* Change / Status card */}
            <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-[#0f172a] p-4 text-white">
              <div className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                {isCreditSale ? 'Venta a Crédito' : 'Estado de Pago'}
              </div>
              <div className="my-1">
                {isCreditSale ? (
                  <div className="text-sm font-semibold text-blue-200">
                    Se registrará en la cuenta corriente del cliente.
                  </div>
                ) : paymentSummary.changeDue > 0 ? (
                  <div>
                    <div className="text-xs text-emerald-300">Vuelto / Cambio a entregar:</div>
                    <div className="text-2xl font-black text-emerald-400">
                      {money(paymentSummary.changeDue, currencySymbol)}
                    </div>
                  </div>
                ) : paymentSummary.remainingAmount > 0 ? (
                  <div>
                    <div className="text-xs text-red-300">Monto restante por cobrar:</div>
                    <div className="text-2xl font-black text-red-400">
                      {money(paymentSummary.remainingAmount, currencySymbol)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-emerald-300">Pago Exacto Cubierto</div>
                    <div className="text-2xl font-black text-white">
                      {money(paymentSummary.totalPaid, currencySymbol)}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Efectivo recibido: {money(paymentSummary.cashReceived, currencySymbol)}
              </div>
            </div>
          </div>

          {/* Payment Methods / Lines */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-stone-600">
                Medio(s) de Pago
              </span>
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCreditSale}
                  onChange={(e) => onIsCreditSaleChange(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Venta a crédito (Cuenta Corriente)</span>
              </label>
            </div>

            {!isCreditSale ? (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const exactAmount = getExactAmountForLine(payment.id);
                  const quickAmounts = getQuickCashAmounts(exactAmount).filter((amt) => amt !== exactAmount);

                  return (
                    <div key={payment.id} className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <select
                          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-900 outline-none focus:border-emerald-500"
                          value={payment.method}
                          onChange={(e) =>
                            onUpdatePaymentLine(payment.id, { method: e.target.value as PaymentMethod })
                          }
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option
                              key={method}
                              value={method}
                              disabled={method === 'Cash' && !canAcceptCash}
                            >
                              {method === 'Cash'
                                ? canAcceptCash
                                  ? '💵 Efectivo'
                                  : '💵 Efectivo (Requiere apertura de caja)'
                                : method === 'Card'
                                  ? '💳 Tarjeta'
                                  : method === 'E-Wallet'
                                    ? '📱 Billetera Virtual / QR'
                                    : method === 'Bank Transfer'
                                      ? '🏦 Transferencia Bancaria'
                                      : method}
                            </option>
                          ))}
                        </select>

                        <Input
                          type="number"
                          step="any"
                          placeholder={payment.method === 'Cash' ? 'Efectivo recibido' : 'Monto'}
                          value={payment.amount}
                          onChange={(e) => onUpdatePaymentLine(payment.id, { amount: e.target.value })}
                          className="h-10 text-sm font-bold"
                        />

                        {payments.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => onRemovePaymentLine(payment.id)}
                            className="h-10 px-3 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl"
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>

                      {/* Reference number for non-cash */}
                      {requiresReferenceNumber(payment.method) ? (
                        <Input
                          placeholder={
                            payment.method === 'Card'
                              ? 'Nro. de cupón / referencia de tarjeta'
                              : payment.method === 'E-Wallet'
                                ? 'Nro. de operación de billetera virtual'
                                : 'Nro. de comprobante de transferencia'
                          }
                          value={payment.referenceNumber}
                          onChange={(e) => onUpdatePaymentLine(payment.id, { referenceNumber: e.target.value })}
                          className="h-9 text-xs"
                        />
                      ) : null}

                      {/* Quick cash pills */}
                      {payment.method === 'Cash' ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => onSetPaymentLineAmount(payment.id, exactAmount)}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                          >
                            Exacto ({money(exactAmount, currencySymbol)})
                          </button>
                          {quickAmounts.map((amt) => (
                            <button
                              key={`${payment.id}-${amt}`}
                              type="button"
                              onClick={() => onSetPaymentLineAmount(payment.id, amt)}
                              className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700 hover:bg-stone-200"
                            >
                              {money(amt, currencySymbol)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={onAddPaymentLine}
                  className="text-xs font-bold text-sky-700 hover:underline"
                >
                  + Dividir pago (Agregar otra línea)
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                <div>
                  <label className="font-semibold block mb-1">Fecha de vencimiento:</label>
                  <Input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => onCreditDueDateChange(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="flex items-center">
                  <p className="text-[11px] leading-tight text-blue-800">
                    Se creará una cuenta por cobrar asociada al cliente seleccionado para su posterior cobro en cobranzas.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Discounts, Points and Notes Section */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                Descuento Manual ($)
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={discountAmount}
                onChange={(e) => onDiscountAmountChange(e.target.value)}
                className="h-10 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                Canjear Puntos ({selectedCustomer?.loyaltyBalance ?? 0} disp.)
              </label>
              <Input
                type="number"
                min="0"
                max={selectedCustomer?.loyaltyBalance ?? 0}
                placeholder="0"
                value={loyaltyPointsToRedeem}
                onChange={(e) => onLoyaltyPointsChange(e.target.value)}
                className="h-10 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                Notas del Comprobante
              </label>
              <Input
                placeholder="Observaciones de la venta..."
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                className="h-10 text-xs"
              />
            </div>
          </div>

          {paymentError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
              {paymentError}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 p-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar [Escape]
          </Button>

          <Button
            type="button"
            disabled={!canCompleteSale || loading}
            onClick={() => void onCompleteSale()}
            className="px-8 font-black text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading
              ? 'Procesando venta...'
              : !isOnline
                ? 'Encolar Venta Sin Conexión'
                : 'Confirmar y Facturar [Ctrl + Enter]'}
          </Button>
        </div>
      </div>
    </div>
  );
}
