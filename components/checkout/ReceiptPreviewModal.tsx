'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ThermalReceipt, {
  type ReceiptSale,
  type ReceiptShop,
  type ReceiptWidth
} from '@/components/receipts/ThermalReceipt';
import { openCashDrawer } from '@/lib/cash-drawer';
import { money } from '@/lib/format';
import { getPaymentMethodLabel } from '@/lib/payments';

type ReceiptPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sale: ReceiptSale | null;
  shop: ReceiptShop;
  currencySymbol: string;
  receiptHeader: string | null;
  receiptFooter: string | null;
  receiptWidth: ReceiptWidth;
  receiptShowBrandMark?: boolean;
  printerSafeMode?: boolean;
  cashDrawerKickEnabled?: boolean;
  isOfflineReceipt?: boolean;
};

function ReceiptPreviewDialog({
  onClose,
  sale,
  shop,
  currencySymbol,
  receiptHeader,
  receiptFooter,
  receiptWidth,
  receiptShowBrandMark = false,
  printerSafeMode = true,
  cashDrawerKickEnabled = false,
  isOfflineReceipt = false
}: Omit<ReceiptPreviewModalProps, 'isOpen' | 'sale'> & { sale: ReceiptSale }) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerFeedback, setDrawerFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const changeDueAmount = Number(sale.changeDue);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (
        (event.key === 'p' || event.key === 'P') &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        window.print();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleOpenDrawer() {
    if (drawerBusy) return;
    setDrawerBusy(true);
    setDrawerFeedback(null);

    try {
      const result = await openCashDrawer({
        source: 'receipt-print',
        saleId: sale.id,
        receiptNumber: sale.receiptNumber,
        triggeredAt: new Date().toISOString()
      });

      setDrawerFeedback({
        tone: !result.ok ? 'error' : result.mode === 'browser-event' ? 'warning' : 'success',
        message: result.message
      });
    } catch (error) {
      setDrawerFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? `No se pudo abrir el cajón: ${error.message}`
            : 'No se pudo abrir el cajón de efectivo.'
      });
    } finally {
      setDrawerBusy(false);
    }
  }

  return (
    <div
      className="receipt-modal-portal fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-3 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket ${sale.receiptNumber}`}
        className="receipt-modal-dialog flex max-h-[86vh] w-full max-w-[440px] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Compact Header */}
        <div className="receipt-print-hide flex items-center justify-between gap-3 border-b border-stone-100 bg-white px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                isOfflineReceipt
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-stone-950">
                {isOfflineReceipt ? 'Venta guardada sin conexión' : '¡Venta registrada!'}
              </h3>
              <p className="truncate text-xs font-semibold text-stone-500">
                Ticket {sale.receiptNumber} • {getPaymentMethodLabel(sale.paymentMethod)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-base font-bold text-stone-600 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
            title="Cerrar ventana [Esc]"
            aria-label="Cerrar vista de ticket"
          >
            ✕
          </button>
        </div>

        {/* Quick Amount & Change Summary Bar */}
        <div className="receipt-print-hide flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 bg-[#0f172a] px-5 py-2.5 text-white">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total cobrado
            </span>
            <div className="text-lg font-black tabular-nums text-white">
              {money(sale.totalAmount, currencySymbol)}
            </div>
          </div>

          {changeDueAmount > 0 ? (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Vuelto a entregar
              </span>
              <span className="text-base font-black tabular-nums text-emerald-400">
                {money(changeDueAmount, currencySymbol)}
              </span>
            </div>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
              {sale.isCreditSale ? 'En cuenta corriente' : 'Pago exacto'}
            </span>
          )}
        </div>

        {drawerFeedback ? (
          <div
            className={`receipt-print-hide border-b px-4 py-2 text-xs font-semibold ${
              drawerFeedback.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : drawerFeedback.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {drawerFeedback.message}
          </div>
        ) : null}

        {/* Scrollable Thermal Ticket Preview */}
        <div className="receipt-modal-scroll flex-1 overflow-y-auto bg-stone-100/80 px-3 py-4">
          <ThermalReceipt
            sale={sale}
            shop={shop}
            currencySymbol={currencySymbol}
            receiptHeader={receiptHeader}
            receiptFooter={receiptFooter}
            receiptWidth={receiptWidth}
            receiptShowBrandMark={receiptShowBrandMark}
            printerSafeMode={printerSafeMode}
            cashDrawerKickEnabled={cashDrawerKickEnabled}
            hideActions
          />
        </div>

        {/* Fast Action Footer */}
        <div className="receipt-print-hide flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white px-4 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="group inline-flex h-11 items-center gap-2 rounded-2xl border-2 border-stone-300 bg-stone-50 px-4 text-xs font-black uppercase tracking-wide text-stone-800 transition hover:border-stone-800 hover:bg-stone-900 hover:text-white active:scale-95"
              title="Imprimir ticket [P]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              <span>Imprimir</span>
              <span className="rounded bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-bold text-stone-600 transition group-hover:bg-white/20 group-hover:text-white">
                [P]
              </span>
            </button>

            {cashDrawerKickEnabled ? (
              <button
                type="button"
                onClick={handleOpenDrawer}
                disabled={drawerBusy}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 transition hover:bg-stone-100 active:scale-95 disabled:opacity-50"
                title="Abrir cajón de efectivo"
              >
                {drawerBusy ? 'Abriendo…' : 'Cajón'}
              </button>
            ) : null}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-950/20 transition hover:bg-emerald-500 active:scale-95 sm:flex-initial"
          >
            <span>Nueva venta / Cerrar</span>
            <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
              [Esc]
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReceiptPreviewModal({
  isOpen,
  sale,
  ...props
}: ReceiptPreviewModalProps) {
  if (!isOpen || !sale || typeof document === 'undefined') return null;

  return createPortal(
    <ReceiptPreviewDialog key={sale.id} sale={sale} {...props} />,
    document.body
  );
}
