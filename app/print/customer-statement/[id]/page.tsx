import { notFound } from 'next/navigation';
import CustomerStatementPrintButton from '@/components/customers/CustomerStatementPrintButton';
import { customerDetailInclude } from '@/lib/customer-operations';
import {
  calculateCustomerLoyaltyBalance,
  customerCreditStatusTone,
  getCustomerCreditStatusLabel,
  getCustomerDisplayName,
  normalizeCustomerCreditStatus
} from '@/lib/customers';
import { dateTime, money, shortDate } from '@/lib/format';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

function toneClasses(tone: string) {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'orange':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'red':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-stone-200 bg-stone-50 text-stone-700';
  }
}

export default async function PrintCustomerStatementPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ openOnly?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const openOnly = query.openOnly === '1';
  const { shopId, shop } = await getActiveShopContext();

  const [customer, settings] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, shopId },
      include: customerDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: { currencySymbol: true }
    })
  ]);

  if (!customer) return notFound();

  const currencySymbol = settings?.currencySymbol ?? 'PHP ';
  const displayName = getCustomerDisplayName(customer);
  const loyaltyBalance =
    customer.loyaltyLedger[0]?.balanceAfter ?? calculateCustomerLoyaltyBalance(customer.loyaltyLedger);
  const receivables = openOnly
    ? customer.creditLedgers.filter((ledger) => Number(ledger.balance) > 0)
    : customer.creditLedgers;
  const totalReceivableBalance = receivables.reduce((sum, ledger) => sum + Number(ledger.balance), 0);
  const totalSales = customer.sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
  const totalReceivablePayments = customer.creditLedgers.reduce(
    (sum, ledger) => sum + ledger.payments.reduce((inner, payment) => inner + Number(payment.amount), 0),
    0
  );

  return (
    <main className="min-h-screen bg-stone-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_28px_60px_-40px_rgba(28,25,23,0.32)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Estado de cuenta del cliente</div>
            <h1 className="mt-2 text-3xl font-black text-stone-950">{displayName}</h1>
            <p className="mt-2 text-sm text-stone-500">
              Consulta ventas recientes, saldo de lealtad y {openOnly ? 'solo cuentas por cobrar abiertas' : 'el historial completo de cuentas por cobrar'}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CustomerStatementPrintButton />
          </div>
        </div>

        <div className="border-b border-stone-200 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{shop.name}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">Estado de cuenta del cliente</h2>
              <div className="mt-2 space-y-1 text-sm text-stone-600">
                {shop.address ? <div>{shop.address}</div> : null}
                <div>
                  {shop.phone ?? 'Sin teléfono registrado'}
                  {shop.email ? ` / ${shop.email}` : ''}
                </div>
              </div>
            </div>
            <div className="text-sm text-stone-600 lg:text-right">
              <div>Generado el {dateTime(new Date().toISOString())}</div>
              <div className="mt-1">Modo: {openOnly ? 'Solo cuentas por cobrar abiertas' : 'Estado de cuenta completo'}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-stone-200 py-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Ventas totales</div>
            <div className="mt-2 text-2xl font-black text-stone-950">{money(totalSales, currencySymbol)}</div>
            <div className="mt-1 text-xs text-stone-500">{customer.sales.length} venta(s) completada(s)</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Cuentas por cobrar abiertas</div>
            <div className="mt-2 text-2xl font-black text-amber-700">{money(totalReceivableBalance, currencySymbol)}</div>
            <div className="mt-1 text-xs text-stone-500">{receivables.filter((ledger) => Number(ledger.balance) > 0).length} balance(s)</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Pagos registrados</div>
            <div className="mt-2 text-2xl font-black text-emerald-700">{money(totalReceivablePayments, currencySymbol)}</div>
            <div className="mt-1 text-xs text-stone-500">Cobros de cuentas por cobrar a la fecha</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Saldo de lealtad</div>
            <div className="mt-2 text-2xl font-black text-stone-950">{loyaltyBalance}</div>
            <div className="mt-1 text-xs text-stone-500">Puntos disponibles</div>
          </div>
        </div>

        <div className="grid gap-6 py-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Perfil del cliente</div>
              <h3 className="mt-2 text-xl font-black text-stone-950">{displayName}</h3>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Tipo de cliente</div>
                  <div className="mt-1 font-semibold text-stone-900">{customer.type === 'BUSINESS' ? 'Empresa' : 'Persona'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Teléfono</div>
                  <div className="mt-1 font-semibold text-stone-900">{customer.phone ?? 'Sin teléfono'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Correo electrónico</div>
                  <div className="mt-1 font-semibold text-stone-900">{customer.email ?? 'Sin correo'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Dirección</div>
                  <div className="mt-1 font-semibold text-stone-900">{customer.address ?? 'Sin dirección'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Impuesto / referencia</div>
                  <div className="mt-1 font-semibold text-stone-900">{customer.taxId ?? 'Ninguno'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Creado</div>
                  <div className="mt-1 font-semibold text-stone-900">{shortDate(customer.createdAt)}</div>
                </div>
              </div>
              {customer.notes ? (
                <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
                  {customer.notes}
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Ventas recientes</div>
              <div className="mt-3 space-y-3">
                {customer.sales.length ? customer.sales.slice(0, 10).map((sale) => (
                  <div key={sale.id} className="rounded-[22px] border border-stone-200 bg-white p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-stone-900">{sale.saleNumber}</div>
                        <div className="text-xs text-stone-500">{dateTime(sale.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-stone-900">{money(Number(sale.totalAmount), currencySymbol)}</div>
                        <div className="text-xs text-stone-500">{sale.paymentMethod}</div>
                      </div>
                    </div>
                  </div>
                )) : <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">Aún no hay ventas completadas.</div>}
              </div>
            </div>
          </section>

          <section>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Libro de cuentas por cobrar</div>
            <div className="mt-3 space-y-4">
              {receivables.length ? receivables.map((ledger) => {
                const status = normalizeCustomerCreditStatus(ledger.status, ledger.dueDate, Number(ledger.balance));
                return (
                  <div key={ledger.id} className="rounded-[26px] border border-stone-200 bg-white p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-stone-900">{ledger.sale?.saleNumber ?? 'Venta a crédito'}</div>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClasses(customerCreditStatusTone(status))}`}>
                            {getCustomerCreditStatusLabel(status)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-stone-500">Vence {shortDate(ledger.dueDate)} / Abierta {shortDate(ledger.createdAt)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm lg:min-w-[280px]">
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Original</div>
                          <div className="font-semibold text-stone-900">{money(Number(ledger.originalAmount), currencySymbol)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Balance</div>
                          <div className="font-semibold text-stone-900">{money(Number(ledger.balance), currencySymbol)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {ledger.payments.length ? ledger.payments.map((payment) => (
                        <div key={payment.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-stone-900">
                                {payment.method === 'Cash'
                                  ? 'Efectivo'
                                  : payment.method === 'Card'
                                  ? 'Tarjeta'
                                  : payment.method === 'E-Wallet'
                                  ? 'Billetera virtual'
                                  : payment.method === 'Bank Transfer'
                                  ? 'Transferencia bancaria'
                                  : payment.method}
                              </div>
                              <div className="mt-1 text-xs text-stone-500">
                                {shortDate(payment.paidAt)} por {payment.createdByUser.name ?? payment.createdByUser.email}
                                {payment.referenceNumber ? ` / Ref. ${payment.referenceNumber}` : ''}
                              </div>
                            </div>
                            <div className="font-semibold text-stone-900">{money(Number(payment.amount), currencySymbol)}</div>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                          Aún no se registran pagos para esta cuenta por cobrar.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }) : <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">No hay cuentas por cobrar que coincidan con este modo de estado de cuenta.</div>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}