import AppHeader from '@/components/layout/AppHeader';
import SalesTable from '@/components/sales/SalesTable';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function SalesPage() {
  const { shopId, permissions } = await getActiveShopContext();
  const [sales, settings] = await Promise.all([
    prisma.sale.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 75
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Historial de ventas"
        subtitle="Revisa transacciones, consulta detalles de pago y vuelve a abrir recibos sin salir del registro de auditoría."
      />
      <SalesTable
        sales={sales.map((sale) => ({
          ...sale,
          totalAmount: sale.totalAmount.toString(),
          createdAt: sale.createdAt.toISOString()
        }))}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        canRefundSales={permissions.REFUND_SALES}
        canVoidSales={permissions.VOID_SALES}
      />
    </div>
  );
}
