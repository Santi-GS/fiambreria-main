import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { getAdjustmentTypeLabel, getSaleStatusLabel } from '@/lib/business-labels';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { getCustomerDisplayName } from '@/lib/customers';
import { dateTime, money } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSaleRefundState, saleDetailInclude } from '@/lib/sale-adjustments';

export default async function SaleDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { shopId, shop, permissions } = await getActiveShopContext();
  const { id } = await params;

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  const currencySymbol = settings?.currencySymbol ?? '₱';
  const refundState = getSaleRefundState(sale);
  const canRefundSales = permissions.REFUND_SALES;
  const canVoidSales = permissions.VOID_SALES;

  return (
    <div className="space-y-6">
      <AppHeader title={sale.saleNumber} subtitle={`Recibo ${sale.receiptNumber} | ${dateTime(sale.createdAt)}`} />

      <div className="flex flex-wrap gap-3">
        <Link href={`/sales/${sale.id}/refund`}>
          <Button type="button" disabled={!canRefundSales || !refundState.canRefund}>Reembolso / Cambio</Button>
        </Link>
        <Link href={`/sales/${sale.id}/void`}>
          <Button type="button" variant="secondary" disabled={!canVoidSales || !refundState.canVoid}>Anular venta</Button>
        </Link>
        <Link href={`/print/receipt/${sale.id}`}>
          <Button type="button" variant="secondary">Abrir recibo</Button>
        </Link>
        <Link href={`/print/receipt/${sale.id}?autoprint=1`}>
          <Button type="button" variant="secondary">Reimprimir recibo</Button>
        </Link>
        <Link href="/returns">
          <Button type="button" variant="ghost">Historial de devoluciones</Button>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Vista previa del recibo</h2>

          <div className="mt-5 space-y-3 text-sm">
            <div>
              <div className="font-black text-stone-900">{settings?.receiptHeader || shop.name}</div>
              <div className="text-stone-500">{shop.address ?? 'Sin dirección configurada'}</div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div>Número de recibo: <span className="font-semibold">{sale.receiptNumber}</span></div>
              <div>Cajero: <span className="font-semibold">{sale.cashierName ?? 'Cajero'}</span></div>
              <div>Método de pago: <span className="font-semibold">{sale.paymentMethod}</span></div>
              <div>Fecha: <span className="font-semibold">{dateTime(sale.createdAt)}</span></div>
            </div>

            <div className="space-y-2 rounded-2xl border border-stone-200 p-4">
              {sale.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.productName} x {item.qty}</span>
                  <span>{money(item.lineTotal.toString(), currencySymbol)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal.toString(), currencySymbol)}</span></div>
                <div className="flex justify-between"><span>Impuesto</span><span>{money(sale.taxAmount.toString(), currencySymbol)}</span></div>
                <div className="flex justify-between"><span>Descuento</span><span>-{money(sale.discountAmount.toString(), currencySymbol)}</span></div>
                <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-black"><span>Total</span><span>{money(sale.totalAmount.toString(), currencySymbol)}</span></div>
            </div>

            <div className="text-xs text-stone-500">{settings?.receiptFooter ?? 'Gracias por tu compra.'}</div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Datos de la venta</h2>
          <div className="mt-5 space-y-3 text-sm text-stone-600">
            <div>Cliente: <span className="font-semibold text-stone-900">{sale.customer ? getCustomerDisplayName(sale.customer) : sale.customerName ?? 'Cliente mostrador'}</span></div>
            <div>Teléfono: <span className="font-semibold text-stone-900">{sale.customerPhone ?? 'N/D'}</span></div>
            {sale.customer?.email ? <div>Correo: <span className="font-semibold text-stone-900">{sale.customer.email}</span></div> : null}
            <div>Tipo de cliente: <span className="font-semibold text-stone-900">{sale.customer?.type ?? 'WALK_IN'}</span></div>
            <div>Notas: <span className="font-semibold text-stone-900">{sale.notes ?? 'N/D'}</span></div>
            <div>Estado: <span className="font-semibold text-stone-900">{getSaleStatusLabel(sale.status)}</span></div>
            <div>Venta a crédito: <span className="font-semibold text-stone-900">{sale.isCreditSale ? 'Sí' : 'No'}</span></div>
            {sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0 ? (
              <div>
                Lealtad: <span className="font-semibold text-stone-900">+{sale.loyaltyPointsEarned} ganados / -{sale.loyaltyPointsRedeemed} canjeados</span>
              </div>
            ) : null}
            {sale.customerCreditLedger ? (
              <>
                <div>Fecha de vencimiento: <span className="font-semibold text-stone-900">{dateTime(sale.customerCreditLedger.dueDate)}</span></div>
                <div>Saldo por cobrar: <span className="font-semibold text-stone-900">{money(sale.customerCreditLedger.balance.toString(), currencySymbol)}</span></div>
              </>
            ) : null}
            <div>Importe restante reembolsable: <span className="font-semibold text-stone-900">{money(refundState.refundableAmount, currencySymbol)}</span></div>
            {sale.voidReason ? <div>Motivo de anulación: <span className="font-semibold text-stone-900">{sale.voidReason}</span></div> : null}
          </div>

          <div className="mt-6 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <div>
              {refundState.canVoid
                ? canVoidSales
                  ? 'Esta venta aún puede ser anulada en su totalidad.'
                  : 'Esta venta aún podría anularse, pero tu cuenta no tiene permisos de anulación.'
                : sale.isCreditSale
                  ? 'Las ventas a crédito están bloqueadas para reembolsos/anulaciones para mantener la coherencia de las cuentas por cobrar.'
                  : 'La anulación total ya no está disponible porque la venta ya tiene ajustes o ya fue anulada.'}
            </div>
            <div className="mt-2">
              {refundState.canRefund
                ? canRefundSales
                  ? 'Las acciones de reembolso y cambio aún están disponibles para las cantidades restantes.'
                  : 'Quedan cantidades reembolsables, pero tu cuenta no tiene permisos de reembolso.'
                : sale.isCreditSale
                  ? 'Las acciones de reembolso y cambio están deshabilitadas para ventas a crédito.'
                  : 'No quedan cantidades reembolsables en esta venta.'}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Historial de ajustes</div>
            <h2 className="mt-2 text-xl font-black text-stone-900">Anulaciones, reembolsos y cambios</h2>
            <p className="mt-1 text-sm text-stone-500">Cada ajuste está vinculado a la venta original, al usuario actuante y a la cuenta del gerente o administrador que lo aprobó.</p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            {sale.adjustments.length} ajuste(s)
          </div>
        </div>

        <div className="space-y-4">
          {sale.adjustments.map((adjustment) => (
            <div key={adjustment.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={adjustment.type === 'VOID' ? 'red' : adjustment.type === 'EXCHANGE' ? 'blue' : 'amber'}>
                      {getAdjustmentTypeLabel(adjustment.type)}
                    </Badge>
                    <span className="text-sm font-semibold text-stone-900">{adjustment.adjustmentNumber}</span>
                  </div>
                  <div className="mt-3 text-sm text-stone-700">{adjustment.reason}</div>
                  <div className="mt-2 text-xs text-stone-500">
                    Creado: {dateTime(adjustment.createdAt)} por {adjustment.createdByUser.name ?? adjustment.createdByUser.email}
                  </div>
                  <div className="mt-1 text-xs text-stone-500">
                    Aprobado por: {adjustment.approvedByUser.name ?? adjustment.approvedByUser.email}
                  </div>
                  {adjustment.notes ? <div className="mt-3 rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{adjustment.notes}</div> : null}
                </div>
                <div className="min-w-[240px] space-y-2">
                  <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    Crédito: {money(adjustment.subtotal.toString(), currencySymbol)} / Reembolsado: {money(adjustment.totalAmount.toString(), currencySymbol)}
                  </div>
                  {adjustment.exchangeSale ? (
                    <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                      Venta de cambio: {adjustment.exchangeSale.saleNumber} / Cobrado: {money(adjustment.exchangeSale.totalAmount.toString(), currencySymbol)}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <Link href={`/print/refund/${adjustment.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                      Recibo del ajuste
                    </Link>
                    {adjustment.exchangeSale ? (
                      <Link href={`/sales/${adjustment.exchangeSale.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                        Venta de cambio
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {adjustment.items.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="mt-1">{item.itemType} / {item.disposition} / Cant. {item.qty}</div>
                    <div className="mt-1">{money(item.lineTotal.toString(), currencySymbol)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!sale.adjustments.length ? (
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
              Aún no se han procesado ajustes para esta venta.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
