import AppHeader from '@/components/layout/AppHeader';
import CustomerDirectoryManager from '@/components/customers/CustomerDirectoryManager';
import type { CustomerRecord } from '@/components/customers/CustomerDirectoryManager';
import { requirePageRole } from '@/lib/authz';
import { customerDetailInclude } from '@/lib/customer-operations';
import { serializeCustomer } from '@/lib/customers';
import { prisma } from '@/lib/prisma';

export default async function CustomersPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      where: { shopId },
      include: customerDetailInclude,
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Clientes"
        subtitle="Gestiona registros de clientes, historial de compras, saldos de fidelidad y cuentas por cobrar abiertas desde un solo espacio operativo."
      />
      <CustomerDirectoryManager
        customers={customers.map((customer) => serializeCustomer(customer)) as unknown as CustomerRecord[]}
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
      />
    </div>
  );
}
