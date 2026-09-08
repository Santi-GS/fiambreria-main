import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import PurchaseManager from '@/components/purchases/PurchaseManager';
import type { Purchase as PurchaseView } from '@/components/purchases/PurchaseManager';
import Card from '@/components/ui/Card';
import { requirePageRole } from '@/lib/authz';
import { purchaseDetailInclude } from '@/lib/purchase-operations';
import { prisma } from '@/lib/prisma';
import { serializePurchase } from '@/lib/purchases';
import { ensureUnitsOfMeasure } from '@/lib/uom';

export default async function PurchasesPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const units = await ensureUnitsOfMeasure(shopId);
  const [suppliers, products, purchases, settings] = await Promise.all([
    prisma.supplier.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' }
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true },
      include: {
        baseUnitOfMeasure: true,
        uomConversions: {
          include: {
            unitOfMeasure: true
          },
          orderBy: {
            ratioToBase: 'asc'
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.purchaseOrder.findMany({
      where: { shopId },
      include: purchaseDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: 40
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);
  const missingSetup = [
    suppliers.length === 0 ? { href: '/suppliers', label: 'Añadir al menos un proveedor' } : null,
    products.length === 0 ? { href: '/products', label: 'Añadir al menos un producto' } : null
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <div className="space-y-6">
      <AppHeader
        title="Compras"
        subtitle="Gestiona órdenes de compra, envíos, recepciones, facturación y pagos a proveedores sin perder precisión del inventario."
      />
      {missingSetup.length ? (
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Configuración necesaria</div>
          <h2 className="mt-2 text-xl font-black text-stone-900">Las compras requieren algunos registros maestros</h2>
          <p className="mt-2 text-sm text-stone-500">
            Esta sucursal puede revisar el historial existente, pero las nuevas órdenes deben esperar hasta tener proveedores y productos. Así las compras se basan en datos operativos reales.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {missingSetup.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-300 hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      <PurchaseManager
        suppliers={suppliers}
        products={products.map((product) => ({
          ...product,
          cost: product.cost.toString()
        }))}
        units={units}
        purchases={purchases.map((purchase) => serializePurchase(purchase) as unknown as PurchaseView)}
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
      />
    </div>
  );
}
