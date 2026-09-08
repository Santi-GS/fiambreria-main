import { ShopRole } from '@prisma/client';

export const PERMISSION_KEYS = [
  'VIEW_REPORTS',
  'EDIT_PRODUCTS',
  'VOID_SALES',
  'REFUND_SALES',
  'ADJUST_INVENTORY',
  'VIEW_PURCHASE_COSTS',
  'MANAGE_STAFF'
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionState = Record<PermissionKey, boolean>;

const DEFAULT_ROLE_PERMISSIONS: Record<ShopRole, PermissionKey[]> = {
  ADMIN: [...PERMISSION_KEYS],
  MANAGER: [
    'VIEW_REPORTS',
    'EDIT_PRODUCTS',
    'VOID_SALES',
    'REFUND_SALES',
    'ADJUST_INVENTORY',
    'VIEW_PURCHASE_COSTS'
  ],
  CASHIER: ['VOID_SALES', 'REFUND_SALES']
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  VIEW_REPORTS: 'Ver reportes',
  EDIT_PRODUCTS: 'Editar productos',
  VOID_SALES: 'Anular ventas',
  REFUND_SALES: 'Reembolsar ventas',
  ADJUST_INVENTORY: 'Ajustar inventario',
  VIEW_PURCHASE_COSTS: 'Ver costos de compra',
  MANAGE_STAFF: 'Gestionar personal'
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  VIEW_REPORTS: 'Abrir reportes del propietario y de la sucursal.',
  EDIT_PRODUCTS: 'Crear, actualizar, archivar y restaurar productos.',
  VOID_SALES: 'Iniciar anulaciones de ventas.',
  REFUND_SALES: 'Iniciar reembolsos y cambios.',
  ADJUST_INVENTORY: 'Registrar ajustes manuales de inventario.',
  VIEW_PURCHASE_COSTS: 'Ver datos de costos y valor de compra.',
  MANAGE_STAFF: 'Crear personal, editar roles y gestionar accesos.'
};

export function sanitizePermissionList(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const values = input.filter((value): value is PermissionKey =>
    typeof value === 'string' && (PERMISSION_KEYS as readonly string[]).includes(value)
  );

  return [...new Set(values)];
}

export function getDefaultPermissionList(role: ShopRole): PermissionKey[] {
  return DEFAULT_ROLE_PERMISSIONS[role];
}

export function getDefaultPermissionState(role: ShopRole): PermissionState {
  const allowed = new Set(getDefaultPermissionList(role));

  return Object.fromEntries(
    PERMISSION_KEYS.map((permission) => [permission, allowed.has(permission)])
  ) as PermissionState;
}

export function getEffectivePermissionState(role: ShopRole, customPermissions?: unknown): PermissionState {
  const sanitizedCustom = sanitizePermissionList(customPermissions);

  if (!sanitizedCustom.length) {
    return getDefaultPermissionState(role);
  }

  const allowed = new Set(sanitizedCustom);

  return Object.fromEntries(
    PERMISSION_KEYS.map((permission) => [permission, allowed.has(permission)])
  ) as PermissionState;
}

export function hasPermission(
  role: ShopRole,
  customPermissions: unknown,
  permission: PermissionKey
) {
  return getEffectivePermissionState(role, customPermissions)[permission];
}

export function normalizePermissionOverride(
  role: ShopRole,
  selectedPermissions: PermissionKey[]
) {
  const normalized = sanitizePermissionList(selectedPermissions);
  const defaults = getDefaultPermissionList(role);

  if (
    normalized.length === defaults.length &&
    normalized.every((permission) => defaults.includes(permission))
  ) {
    return null;
  }

  return normalized;
}
