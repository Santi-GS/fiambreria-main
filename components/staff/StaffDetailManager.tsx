'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';
import {
  getDefaultPermissionList,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey
} from '@/lib/permissions';
import { SerializedAuthAuditLog } from '@/lib/serializers/staff';

type ManagedShop = {
  id: string;
  name: string;
  slug: string;
};

type StaffDetail = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  shopId: string;
  shopName: string;
  shopSlug: string;
  isActive: boolean;
  assignedAt: string;
  disabledAt: string | null;
  lastLogin: string | null;
  customPermissions: PermissionKey[];
  authActivity: SerializedAuthAuditLog[];
  hasPin: boolean;
  pinSetAt: string | null;
  emailVerifiedAt: string | null;
  forcePasswordReset: boolean;
  lockedUntil: string | null;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function authTone(action: string) {
  if (action.includes('FAILURE') || action.includes('BLOCKED')) {
    return 'red';
  }

  if (action.includes('COMPLETED') || action.includes('SUCCESS')) {
    return 'emerald';
  }

  return 'amber';
}

function getPermissionDraft(role: StaffDetail['role'], customPermissions: PermissionKey[]) {
  return customPermissions.length ? customPermissions : getDefaultPermissionList(role);
}

function isLocked(lockedUntil: string | null) {
  return Boolean(lockedUntil && new Date(lockedUntil) > new Date());
}

export default function StaffDetailManager({
  initialStaff,
  shops
}: {
  initialStaff: StaffDetail;
  shops: ManagedShop[];
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [assignment, setAssignment] = useState({
    role: initialStaff.role,
    shopId: initialStaff.shopId,
    isActive: initialStaff.isActive,
    customPermissions: getPermissionDraft(initialStaff.role, initialStaff.customPermissions)
  });
  const [pin, setPin] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [resetExpiresAt, setResetExpiresAt] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [issuingReset, setIssuingReset] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  async function saveAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignmentError('');
    setAssignmentSuccess('');
    setSavingAssignment(true);

    const response = await fetch(`/api/staff/${staff.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignment)
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo actualizar el registro del personal.' }));
    setSavingAssignment(false);

    if (!response.ok || !data?.item) {
      setAssignmentError(data?.error ?? 'No se pudo actualizar el registro del personal.');
      return;
    }

    setStaff((current) => ({
      ...current,
      ...data.item,
      hasPin: data.item.role === 'CASHIER' ? current.hasPin : false,
      pinSetAt: data.item.role === 'CASHIER' ? current.pinSetAt : null
    }));
    setAssignment({
      role: data.item.role,
      shopId: data.item.shopId,
      isActive: data.item.isActive,
      customPermissions: getPermissionDraft(data.item.role, data.item.customPermissions ?? [])
    });
    setAssignmentSuccess('Asignación del personal actualizada correctamente.');
  }

  async function issueResetLink() {
    setResetError('');
    setResetSuccess('');
    setIssuingReset(true);

    const response = await fetch(`/api/staff/${staff.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInHours: 24 })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo crear el enlace de restablecimiento.' }));
    setIssuingReset(false);

    if (!response.ok) {
      setResetError(data?.error ?? 'No se pudo crear el enlace de restablecimiento.');
      return;
    }

    setResetUrl(data.resetUrl);
    setResetExpiresAt(data.expiresAt);
    setStaff((current) => ({
      ...current,
      forcePasswordReset: true,
      lockedUntil: null
    }));
    setResetSuccess('Enlace de restablecimiento generado. Compártelo de forma segura con el miembro del personal.');
  }

  async function copyResetLink() {
    try {
      await navigator.clipboard.writeText(resetUrl);
      setResetSuccess('Enlace de restablecimiento copiado al portapapeles.');
    } catch {
      setResetError('No se pudo copiar automáticamente el enlace de restablecimiento.');
    }
  }

  async function savePin(nextPin: string | null) {
    setPinError('');
    setPinSuccess('');
    setSavingPin(true);

    const response = await fetch(`/api/staff/${staff.id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: nextPin })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo actualizar el PIN de desbloqueo rápido.' }));
    setSavingPin(false);

    if (!response.ok) {
      setPinError(data?.error ?? 'No se pudo actualizar el PIN de desbloqueo rápido.');
      return;
    }

    setStaff((current) => ({
      ...current,
      hasPin: data.hasPin,
      pinSetAt: data.pinSetAt
    }));
    setPin('');
    setPinSuccess(data.hasPin ? 'PIN del cajero guardado de forma segura.' : 'PIN del cajero eliminado.');
  }

  function togglePermission(permission: PermissionKey) {
    setAssignment((current) => ({
      ...current,
      customPermissions: current.customPermissions.includes(permission)
        ? current.customPermissions.filter((entry) => entry !== permission)
        : [...current.customPermissions, permission]
    }));
  }

  const currentlyLocked = isLocked(staff.lockedUntil);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Perfil del personal</div>
            <h2 className="mt-2 text-3xl font-black text-stone-950">{staff.name}</h2>
            <p className="mt-2 text-sm text-stone-500">{staff.email}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone={staff.isActive ? 'emerald' : 'red'}>
                {staff.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              <Badge tone={staff.role === 'ADMIN' ? 'blue' : staff.role === 'MANAGER' ? 'amber' : 'stone'}>
                {staff.role}
              </Badge>
              <Badge tone="stone">{staff.shopName}</Badge>
              <Badge tone={staff.emailVerifiedAt ? 'emerald' : 'amber'}>
                {staff.emailVerifiedAt ? 'Correo verificado' : 'Correo no verificado'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Asignado</div>
              <div className="mt-2 text-lg font-black text-stone-950">{shortDate(staff.assignedAt)}</div>
              <div className="mt-1 text-sm text-stone-500">{staff.shopSlug}</div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Último acceso</div>
              <div className="mt-2 text-lg font-black text-stone-950">
                {staff.lastLogin ? dateTime(staff.lastLogin) : 'Nunca'}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                {staff.disabledAt ? `Desactivado ${dateTime(staff.disabledAt)}` : 'La asignación actual está activa.'}
              </div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Estado de seguridad</div>
              <div className="mt-2 text-lg font-black text-stone-950">
                {currentlyLocked ? 'Bloqueado temporalmente' : staff.forcePasswordReset ? 'Restablecimiento requerido' : 'Correcto'}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                {currentlyLocked
                  ? `Se desbloquea ${dateTime(staff.lockedUntil!)}`
                  : staff.forcePasswordReset
                    ? 'El próximo acceso requiere un restablecimiento emitido por un administrador.'
                    : 'No hay bloqueo activo ni restablecimiento obligatorio.'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Controles de asignación</div>
          <h3 className="mt-2 text-xl font-black text-stone-950">Rol, tienda y acceso</h3>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Actualiza el rol del miembro, mueve la asignación a otra tienda gestionada o suspende el acceso de forma segura.
          </p>

          <form onSubmit={saveAssignment} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">Rol</label>
                <select
                  className={selectClassName}
                  value={assignment.role}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      role: event.target.value as StaffDetail['role'],
                      customPermissions: getPermissionDraft(event.target.value as StaffDetail['role'], [])
                    }))
                  }
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="CASHIER">Cajero</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">Tienda asignada</label>
                <select
                  className={selectClassName}
                  value={assignment.shopId}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      shopId: event.target.value
                    }))
                  }
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={assignment.isActive}
                onChange={(event) =>
                  setAssignment((current) => ({
                    ...current,
                    isActive: event.target.checked
                  }))
                }
              />
              La asignación está activa y puede acceder a la tienda seleccionada
            </label>

            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Matriz de permisos</div>
              <div className="mt-2 text-sm text-stone-600">
                Comienza con los permisos predeterminados del rol seleccionado y ajústalos para esta asignación cuando sea necesario.
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {PERMISSION_KEYS.map((permission) => (
                  <label key={permission} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={assignment.customPermissions.includes(permission)}
                      onChange={() => togglePermission(permission)}
                    />
                    <span>
                      <span className="block font-semibold text-stone-900">{PERMISSION_LABELS[permission]}</span>
                      <span className="mt-1 block text-xs text-stone-500">{PERMISSION_DESCRIPTIONS[permission]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {assignmentError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{assignmentError}</div>
            ) : null}

            {assignmentSuccess ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {assignmentSuccess}
              </div>
            ) : null}

            <Button type="submit" disabled={savingAssignment}>
              {savingAssignment ? 'Guardando cambios...' : 'Guardar asignación'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Seguridad de la cuenta</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">Verificación, bloqueo y restablecimiento</h3>
            <div className="mt-5 space-y-3 text-sm text-stone-600">
              <div>Verificación de correo: <span className="font-semibold text-stone-900">{staff.emailVerifiedAt ? `Verificado ${dateTime(staff.emailVerifiedAt)}` : 'Aún no verificado'}</span></div>
              <div>Restablecimiento obligatorio: <span className="font-semibold text-stone-900">{staff.forcePasswordReset ? 'Requerido en el próximo acceso' : 'No requerido'}</span></div>
              <div>Bloqueo de acceso: <span className="font-semibold text-stone-900">{currentlyLocked ? `Bloqueado hasta ${dateTime(staff.lockedUntil!)}` : 'Sin bloqueo activo'}</span></div>
            </div>
          </Card>

          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Restablecimiento de contraseña</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">Enlace de restablecimiento administrado</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Genera un enlace de un solo uso que caduca en 24 horas. El token original nunca se almacena en la base de datos.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={issueResetLink} disabled={issuingReset}>
                {issuingReset ? 'Generando enlace...' : 'Generar enlace de restablecimiento'}
              </Button>
              {resetUrl ? (
                <Button type="button" variant="secondary" onClick={copyResetLink}>
                  Copiar enlace
                </Button>
              ) : null}
            </div>

            {resetUrl ? (
              <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Enlace seguro</div>
                <div className="mt-2 break-all text-sm text-stone-700">{resetUrl}</div>
                <div className="mt-2 text-xs text-stone-500">Caduca {dateTime(resetExpiresAt)}</div>
              </div>
            ) : null}

            {resetError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resetError}</div>
            ) : null}

            {resetSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {resetSuccess}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Desbloqueo rápido del cajero</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">PIN opcional del personal</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Guarda el PIN del cajero como un hash seguro. Esto permite flujos de desbloqueo rápido sin almacenar el PIN en texto plano.
            </p>

            {staff.role === 'CASHIER' ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="PIN de 4 a 8 dígitos"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                  />
                  <Button type="button" onClick={() => savePin(pin)} disabled={savingPin}>
                    {savingPin ? 'Guardando...' : staff.hasPin ? 'Actualizar PIN' : 'Configurar PIN'}
                  </Button>
                  {staff.hasPin ? (
                    <Button type="button" variant="secondary" onClick={() => savePin(null)} disabled={savingPin}>
                      Borrar PIN
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 text-sm text-stone-500">
                  {staff.hasPin && staff.pinSetAt ? `PIN actualizado por última vez ${dateTime(staff.pinSetAt)}.` : 'Aún no hay un PIN guardado para este cajero.'}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                Los PIN de desbloqueo rápido están limitados a las asignaciones de cajero.
              </div>
            )}

            {pinError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pinError}</div>
            ) : null}

            {pinSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {pinSuccess}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Actividad de autenticación</div>
          <h3 className="mt-2 text-xl font-black text-stone-950">Eventos recientes de acceso y contraseña</h3>
          <p className="mt-2 text-sm text-stone-500">
            Revisa accesos correctos, intentos fallidos, accesos bloqueados y actividad de restablecimiento de contraseña de esta cuenta.
          </p>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">Cuándo</th>
                  <th className="px-4 py-3.5">Acción</th>
                  <th className="px-4 py-3.5">Correo</th>
                  <th className="px-4 py-3.5">IP</th>
                  <th className="px-4 py-3.5">Agente de usuario</th>
                </tr>
              </thead>
              <tbody>
                {staff.authActivity.map((log) => (
                  <tr key={log.id} className="border-t border-stone-200 bg-white">
                    <td className="px-4 py-4 text-stone-600">{dateTime(log.createdAt)}</td>
                    <td className="px-4 py-4">
                      <Badge tone={authTone(log.action)}>{log.action.replaceAll('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-4 text-stone-700">{log.email ?? staff.email}</td>
                    <td className="px-4 py-4 text-stone-600">{log.ipAddress ?? 'N/A'}</td>
                    <td className="max-w-xs px-4 py-4 text-xs text-stone-500">{log.userAgent ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!staff.authActivity.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              Aún no se ha registrado actividad de autenticación para esta cuenta.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
