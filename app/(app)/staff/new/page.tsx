import AppHeader from '@/components/layout/AppHeader';
import StaffCreateForm from '@/components/staff/StaffCreateForm';
import { requirePagePermission } from '@/lib/authz';
import { getManagedShops } from '@/lib/staff';

export default async function NewStaffPage() {
  const { userId, shopId } = await requirePagePermission('MANAGE_STAFF');
  const shops = await getManagedShops(userId);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Agregar personal"
        subtitle="Cree una cuenta de empleado, elija la sucursal asignada y defina el rol inicial sin alterar el flujo de autenticación."
      />
      <StaffCreateForm shops={shops} defaultShopId={shopId} />
    </div>
  );
}
