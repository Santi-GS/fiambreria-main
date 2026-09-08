import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import SaleAdjustmentManager from '@/components/sales/SaleAdjustmentManager';
import { requirePagePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { saleDetailInclude, serializeSaleDetail } from '@/lib/sale-adjustments';

export default async function SaleVoidPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { shopId, session } = await requirePagePermission('VOID_SALES');

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true
      }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title={`Anular ${sale.saleNumber}`}
        subtitle="Revierte la venta completa, repone el inventario, registra el medio de pago y conserva el registro de aprobación asociado al ajuste."
      />

      <SaleAdjustmentManager
        mode="void"
        sale={serializeSaleDetail(sale)}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        currentUserEmail={session.user.email ?? ''}
      />
    </div>
  );
}
