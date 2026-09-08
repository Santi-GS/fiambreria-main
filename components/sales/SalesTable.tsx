import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getSaleStatusLabel } from '@/lib/business-labels';
import { dateTime, money } from '@/lib/format';

type Sale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  createdAt: string;
  totalAmount: string;
  customerName: string | null;
  status: string;
  isCreditSale?: boolean;
};

export default function SalesTable({
  sales,
  currencySymbol,
  canRefundSales,
  canVoidSales
}: {
  sales: Sale[];
  currencySymbol: string;
  canRefundSales: boolean;
  canVoidSales: boolean;
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Transacciones</div>
          <h2 className="mt-2 text-xl font-black text-stone-900">Historial de ventas</h2>
          <p className="mt-1 text-sm text-stone-500">Ventas completadas con acceso al recibo y datos del cajero.</p>
        </div>
        <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
          {sales.length} registro(s)
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[26px] border border-stone-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3.5">Venta</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Cliente</th>
                <th className="px-4 py-3.5">Pago</th>
                <th className="px-4 py-3.5">Cajero</th>
                <th className="px-4 py-3.5">Fecha</th>
                <th className="px-4 py-3.5">Total</th>
                <th className="px-4 py-3.5">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                  <td className="px-4 py-4">
                    <Link href={`/sales/${sale.id}`} className="font-semibold text-emerald-700">
                      {sale.saleNumber}
                    </Link>
                    <div className="mt-1 text-xs text-stone-500">{sale.receiptNumber}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={sale.status === 'VOIDED' ? 'red' : 'emerald'}>{getSaleStatusLabel(sale.status)}</Badge>
                  </td>
                  <td className="px-4 py-4">{sale.customerName ?? 'Cliente ocasional'}</td>
                  <td className="px-4 py-4">
                    <Badge tone="blue">{sale.paymentMethod}</Badge>
                    {sale.isCreditSale ? <div className="mt-2"><Badge tone="amber">Crédito</Badge></div> : null}
                  </td>
                  <td className="px-4 py-4">{sale.cashierName ?? 'Cajero'}</td>
                  <td className="px-4 py-4">{dateTime(sale.createdAt)}</td>
                  <td className="px-4 py-4 font-semibold text-stone-900">{money(sale.totalAmount, currencySymbol)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Link href={`/sales/${sale.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                        Ver
                      </Link>
                      <Link href={`/sales/${sale.id}/receipt`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                        Reimprimir
                      </Link>
                      {canRefundSales ? (
                        <Link href={`/sales/${sale.id}/refund`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                          Reembolso
                        </Link>
                      ) : null}
                      {canVoidSales ? (
                        <Link href={`/sales/${sale.id}/void`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                          Anular
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!sales.length ? (
          <div className="border-t border-stone-200 bg-stone-50 px-6 py-8 text-center text-sm text-stone-500">
            <div className="font-semibold text-stone-900">Aún no hay ventas.</div>
            <div className="mt-2">Inicia un cobro para generar el primer recibo; las reimpresiones y el historial de reembolsos aparecerán aquí automáticamente.</div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
