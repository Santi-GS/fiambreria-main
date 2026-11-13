import AppHeader from '@/components/layout/AppHeader';
import ShopOnboardingWizard from '@/components/shops/ShopOnboardingWizard';
import { requirePageRole } from '@/lib/authz';

export default async function NewShopPage() {
  await requirePageRole('MANAGER');

  return (
    <div className="space-y-6">
      <AppHeader
        title="Nuevo negocio"
        subtitle="Crea un nuevo negocio o sucursal en pocos pasos y comienza a operar de inmediato."
      />
      <ShopOnboardingWizard mode="create" />
    </div>
  );
}
