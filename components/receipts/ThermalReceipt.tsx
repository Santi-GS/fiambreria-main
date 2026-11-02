'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { openCashDrawer } from '@/lib/cash-drawer';
import { dateTime, money, shortDate } from '@/lib/format';
import { getPaymentMethodLabel } from '@/lib/payments';

export type ReceiptWidth = '58mm' | '80mm';

export type ReceiptItem = {
  id: string;
  productName: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
};

export type ReceiptPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  createdAt: string;
};

export type ReceiptSale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  customerEmail?: string | null;
  customerBusinessName?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  isCreditSale: boolean;
  creditDueDate: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  totalPaid: string;
  cashReceived: string;
  changeDue: string;
  notes: string | null;
  createdAt: string;
  payments: ReceiptPayment[];
  items: ReceiptItem[];
};

export type ReceiptShop = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
};

const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn'
};

function sanitizeBarcodeValue(value: string) {
  const sanitized = value.trim().toUpperCase().replace(/[^0-9A-Z.\- $/+%]/g, '-');
  return sanitized || 'RECEIPT';
}

function buildCode39Bars(value: string) {
  const encoded = `*${sanitizeBarcodeValue(value)}*`;

  return encoded
    .split('')
    .map((character, index) => ({
      id: `${character}-${index}`,
      pattern: CODE39_PATTERNS[character] ?? CODE39_PATTERNS['-']
    }))
    .flatMap((segment, segmentIndex) =>
      segment.pattern.split('').map((token, tokenIndex) => ({
        id: `${segment.id}-${tokenIndex}`,
        isBar: tokenIndex % 2 === 0,
        width: token === 'w' ? 3 : 1,
        addGap:
          tokenIndex === segment.pattern.length - 1 && segmentIndex < encoded.length - 1
      }))
    );
}

function buildBrandMark(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'VP'
  );
}

export default function ThermalReceipt({
  sale,
  shop,
  currencySymbol,
  receiptHeader,
  receiptFooter,
  receiptWidth = '80mm',
  receiptShowBrandMark = false,
  printerSafeMode = true,
  cashDrawerKickEnabled = false,
  autoprint = false,
  testMode = false,
  hideActions = false
}: {
  sale: ReceiptSale;
  shop: ReceiptShop;
  currencySymbol: string;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  receiptWidth?: ReceiptWidth;
  receiptShowBrandMark?: boolean;
  printerSafeMode?: boolean;
  cashDrawerKickEnabled?: boolean;
  autoprint?: boolean;
  testMode?: boolean;
  hideActions?: boolean;
}) {
  const paperWidth = receiptWidth === '58mm' ? '58mm' : '80mm';
  const compact = paperWidth === '58mm' || printerSafeMode;
  const brandMark = useMemo(
    () => buildBrandMark(receiptHeader || shop.name),
    [receiptHeader, shop.name]
  );
  const barcodeBars = useMemo(
    () => buildCode39Bars(sale.receiptNumber),
    [sale.receiptNumber]
  );
  const [drawerMessage, setDrawerMessage] = useState('');
  const [drawerTone, setDrawerTone] = useState<'success' | 'warning' | 'error'>('success');
  const [drawerBusy, setDrawerBusy] = useState(false);

  useEffect(() => {
    if (!autoprint) {
      return;
    }

    const timer = setTimeout(() => window.print(), 450);
    return () => clearTimeout(timer);
  }, [autoprint]);

  async function handleDrawerKick() {
    if (drawerBusy) {
      return;
    }

    setDrawerBusy(true);
    setDrawerMessage('');

    try {
      const result = await openCashDrawer({
        source: testMode ? 'print-test' : 'receipt-print',
        saleId: sale.id,
        receiptNumber: sale.receiptNumber,
        triggeredAt: new Date().toISOString()
      });

      setDrawerTone(!result.ok ? 'error' : result.mode === 'browser-event' ? 'warning' : 'success');
      setDrawerMessage(result.message);
    } catch (error) {
      setDrawerTone('error');
      setDrawerMessage(
        error instanceof Error
          ? `No se pudo activar el cajón de efectivo: ${error.message}`
          : 'No se pudo activar el cajón de efectivo.'
      );
    } finally {
      setDrawerBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <style jsx global>{`
        @page {
          size: ${paperWidth} auto;
          margin: ${printerSafeMode ? '2.5mm' : '4mm'};
        }

        @media print {
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }

          body * {
            visibility: hidden;
          }

          .receipt-modal-portal,
          .receipt-modal-dialog,
          .receipt-modal-scroll {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            width: auto !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            transform: none !important;
          }

          .receipt-root,
          .receipt-root * {
            visibility: visible;
          }

          .receipt-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperWidth} !important;
            max-width: ${paperWidth} !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .receipt-print-hide {
            display: none !important;
          }
        }
      `}</style>

      {!hideActions ? (
        <div className="receipt-print-hide flex flex-wrap gap-3">
          <Button type="button" onClick={() => window.print()}>
            {testMode ? 'Imprimir página de prueba' : 'Imprimir recibo'}
          </Button>
          {cashDrawerKickEnabled ? (
            <Button type="button" variant="secondary" onClick={handleDrawerKick} disabled={drawerBusy}>
              {drawerBusy ? 'Activando caja…' : 'Abrir cajón de efectivo'}
            </Button>
          ) : null}
          {drawerMessage ? (
            <div
              className={`max-w-xl rounded-2xl px-4 py-3 text-sm ${
                drawerTone === 'error'
                  ? 'border border-red-200 bg-red-50 text-red-800'
                  : drawerTone === 'warning'
                    ? 'border border-amber-200 bg-amber-50 text-amber-800'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {drawerMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={`receipt-root mx-auto border border-stone-200 bg-white ${
          printerSafeMode ? 'font-mono shadow-none' : 'shadow-sm'
        } ${compact ? 'rounded-2xl p-3.5' : 'rounded-3xl p-5'}`}
        style={{ width: paperWidth, maxWidth: paperWidth }}
      >
        <div className="border-b border-dashed border-stone-300 pb-4 text-center">
          {receiptShowBrandMark ? (
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-stone-900 text-sm font-black tracking-[0.18em] text-stone-950">
              {brandMark}
            </div>
          ) : null}
          <div className={`${compact ? 'text-sm' : 'text-base'} font-black text-stone-900`}>
            {receiptHeader || shop.name}
          </div>
          {shop.address ? (
            <div className={`mt-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-600`}>
              {shop.address}
            </div>
          ) : null}
          {shop.phone || shop.email ? (
            <div className={`mt-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-600`}>
              {shop.phone || ''}
              {shop.phone && shop.email ? ' | ' : ''}
              {shop.email || ''}
            </div>
          ) : null}
          {printerSafeMode ? (
            <div
              className={`mt-2 ${
                compact ? 'text-[10px]' : 'text-[11px]'
              } font-semibold uppercase tracking-[0.18em] text-stone-500`}
            >
              Diseño térmico optimizado para impresora
            </div>
          ) : null}
        </div>

        <div
          className={`space-y-1 border-b border-dashed border-stone-300 py-4 ${
            compact ? 'text-[10px]' : 'text-[11px]'
          } text-stone-700`}
        >
          <div className="flex justify-between gap-3">
            <span>N.º de recibo</span>
            <span className="text-right">{sale.receiptNumber}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>N.º de venta</span>
            <span className="text-right">{sale.saleNumber}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Fecha</span>
            <span className="text-right">{dateTime(sale.createdAt)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Cajero</span>
            <span className="text-right">{sale.cashierName ?? 'Cajero'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Pago</span>
            <span className="text-right">
              {getPaymentMethodLabel(sale.paymentMethod)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Cliente</span>
            <span className="text-right">{sale.customerName ?? 'Consumidor Final'}</span>
          </div>
          {sale.customerBusinessName ? (
            <div className="flex justify-between gap-3">
              <span>Empresa</span>
              <span className="text-right">{sale.customerBusinessName}</span>
            </div>
          ) : null}
          {sale.customerPhone ? (
            <div className="flex justify-between gap-3">
              <span>Teléfono</span>
              <span className="text-right">{sale.customerPhone}</span>
            </div>
          ) : null}
          {sale.customerEmail ? (
            <div className="flex justify-between gap-3">
              <span>Correo electrónico</span>
              <span className="text-right">{sale.customerEmail}</span>
            </div>
          ) : null}
          {sale.isCreditSale && sale.creditDueDate ? (
            <div className="flex justify-between gap-3">
              <span>Vencimiento</span>
              <span className="text-right">{shortDate(sale.creditDueDate)}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-b border-dashed border-stone-300 py-4">
          {sale.items.map((item) => (
            <div key={item.id} className={compact ? 'text-[10px]' : 'text-[11px]'}>
              <div className="font-medium text-stone-900">{item.productName}</div>
              <div className="mt-1 flex justify-between gap-3 text-stone-600">
                <span>
                  {item.qty} x {money(item.unitPrice, currencySymbol)}
                </span>
                <span className="text-right">{money(item.lineTotal, currencySymbol)}</span>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`space-y-1 border-b border-dashed border-stone-300 py-4 ${
            compact ? 'text-[10px]' : 'text-[11px]'
          } text-stone-700`}
        >
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(sale.subtotal, currencySymbol)}</span>
          </div>
          <div className="flex justify-between">
            <span>Impuestos</span>
            <span>{money(sale.taxAmount, currencySymbol)}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>-{money(sale.discountAmount, currencySymbol)}</span>
          </div>
          <div className="flex justify-between pt-2 text-sm font-black text-stone-900">
            <span>Total</span>
            <span>{money(sale.totalAmount, currencySymbol)}</span>
          </div>
        </div>


        <div
          className={`space-y-2 border-b border-dashed border-stone-300 py-4 ${
            compact ? 'text-[10px]' : 'text-[11px]'
          } text-stone-700`}
        >
          <div className="font-semibold text-stone-900">Resumen de pago</div>
          {sale.payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-stone-200 px-3 py-2">
              <div className="flex justify-between gap-3">
                <span>{getPaymentMethodLabel(payment.method)}</span>
                <span className="text-right">{money(payment.amount, currencySymbol)}</span>
              </div>
              {payment.referenceNumber ? (
                <div className="mt-1 text-stone-500">Ref.: {payment.referenceNumber}</div>
              ) : null}
            </div>
          ))}
          <div className="flex justify-between">
            <span>Total pagado</span>
            <span>{money(sale.totalPaid, currencySymbol)}</span>
          </div>
          {Number(sale.cashReceived) > 0 ? (
            <div className="flex justify-between">
              <span>Efectivo recibido</span>
              <span>{money(sale.cashReceived, currencySymbol)}</span>
            </div>
          ) : null}
          {Number(sale.changeDue) > 0 ? (
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Cambio</span>
              <span>{money(sale.changeDue, currencySymbol)}</span>
            </div>
          ) : null}
        </div>

        <div
          className={`border-b border-dashed border-stone-300 py-4 text-center ${
            compact ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          <div className="font-semibold text-stone-900">Código de barras del recibo</div>
          <div className="mt-3 flex h-14 items-end justify-center gap-px rounded-xl border border-stone-200 bg-white px-3 py-2">
            {barcodeBars.map((bar) => (
              <span
                key={bar.id}
                className={bar.isBar ? 'inline-block bg-stone-950' : 'inline-block bg-transparent'}
                style={{
                  width: `${bar.width}px`,
                  height: bar.isBar ? '36px' : '1px',
                  marginRight: bar.addGap ? '1px' : 0
                }}
              />
            ))}
          </div>
          <div className="mt-2 font-mono tracking-[0.24em] text-stone-700">{sale.receiptNumber}</div>
          <div className="mt-2 text-[9px] uppercase tracking-[0.16em] text-stone-400">
            {testMode
              ? 'Prueba de alineación térmica y código de barras'
              : 'Use este identificador para reimpresiones, auditoría y verificación'}
          </div>
        </div>

        {sale.notes ? (
          <div
            className={`border-b border-dashed border-stone-300 py-4 ${
              compact ? 'text-[10px]' : 'text-[11px]'
            } text-stone-600`}
          >
            <div className="font-semibold text-stone-900">Notas</div>
            <div className="mt-1">{sale.notes}</div>
          </div>
        ) : null}

        <div className={`pt-4 text-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-600`}>
          <div className="font-semibold text-stone-900">Política de devolución</div>
          <div className="mt-2">{receiptFooter || '¡Gracias por su compra!'}</div>
        </div>
      </div>
    </div>
  );
}
