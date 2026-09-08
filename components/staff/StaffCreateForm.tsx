'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

type ManagedShop = {
  id: string;
  name: string;
  slug: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

export default function StaffCreateForm({
  shops,
  defaultShopId
}: {
  shops: ManagedShop[];
  defaultShopId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    shopId: defaultShopId
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo crear la cuenta de personal.' }));
    setLoading(false);

    if (!response.ok || !data?.item) {
      setError(data?.error ?? 'No se pudo crear la cuenta de personal.');
      return;
    }

    router.push(`/staff/${data.item.id}`);
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Nuevo miembro del equipo</div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">Crear cuenta de personal</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Cree la cuenta, elija la sucursal asignada y defina el rol en un solo paso. El restablecimiento de contraseñas y la configuración del PIN de cajero se pueden gestionar tras la creación.
          </p>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
          Solo los administradores pueden crear cuentas de personal para las sucursales que gestionan.
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Perfil</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Nombre completo</FieldLabel>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="ej. Juan Pérez"
                required
              />
            </div>

            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="personal@tienda.local"
                required
              />
            </div>

            <div>
              <FieldLabel>Contraseña inicial</FieldLabel>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Al menos 8 caracteres"
                required
              />
            </div>

            <div>
              <FieldLabel>Rol</FieldLabel>
              <select
                className={selectClassName}
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Gerente</option>
                <option value="CASHIER">Cajero</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Asignación</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Sucursal asignada</FieldLabel>
              <select
                className={selectClassName}
                value={form.shopId}
                onChange={(event) => setForm((current) => ({ ...current, shopId: event.target.value }))}
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
              El registro del personal se crea activo de inmediato y la actividad del último acceso aparecerá después del primer inicio de sesión correcto.
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta de personal'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/staff')}>
            Volver al personal
          </Button>
        </div>
      </form>
    </Card>
  );
}
