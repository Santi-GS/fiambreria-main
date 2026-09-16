'use client';

import { ShopRole } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';

type QuickAction = {
  id: string;
  label: string;
  description: string;
  minRole: ShopRole;
  href?: string;
  action?: () => void;
};

const ROLE_WEIGHT: Record<ShopRole, number> = {
  CASHIER: 1,
  MANAGER: 2,
  ADMIN: 3
};

export default function CommandPalette({ role }: { role: ShopRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const actions = useMemo<QuickAction[]>(
    () => [
      {
        id: 'new-sale',
        label: 'Nueva venta',
        description: 'Abrir el punto de venta e iniciar una transacción.',
        minRole: 'CASHIER',
        href: '/checkout'
      },
      {
        id: 'open-register',
        label: 'Abrir caja',
        description: 'Iniciar una sesión de caja con fondo inicial.',
        minRole: 'CASHIER',
        href: '/register/open'
      },
      {
        id: 'close-register',
        label: 'Cerrar caja',
        description: 'Contar la caja y cerrar una sesión activa.',
        minRole: 'CASHIER',
        href: '/register/close'
      },
      {
        id: 'register-history',
        label: 'Historial de caja',
        description: 'Revisar sesiones anteriores y variaciones.',
        minRole: 'CASHIER',
        href: '/register/history'
      },
      {
        id: 'add-product',
        label: 'Añadir producto',
        description: 'Abrir el gestor de catálogo para añadir un producto.',
        minRole: 'MANAGER',
        href: '/products#new-product'
      },
      {
        id: 'add-supplier',
        label: 'Añadir proveedor',
        description: 'Crear o actualizar un registro de proveedor.',
        minRole: 'MANAGER',
        href: '/suppliers#new-supplier'
      },
      {
        id: 'record-purchase',
        label: 'Registrar compra',
        description: 'Crear una orden de compra o recibir inventario.',
        minRole: 'MANAGER',
        href: '/purchases#record-purchase'
      },
      {
        id: 'branch-transfer',
        label: 'Transferencia de sucursal',
        description: 'Crear o recibir transferencias de inventario entre sucursales.',
        minRole: 'MANAGER',
        href: '/transfers'
      },
      {
        id: 'inventory-adjustment',
        label: 'Ajuste de inventario',
        description: 'Aumentar o reducir existencias con registro de auditoría.',
        minRole: 'MANAGER',
        href: '/inventory#adjust-stock'
      },
      {
        id: 'activity-log',
        label: 'Registro de actividad',
        description: 'Revisar acciones recientes de la tienda.',
        minRole: 'MANAGER',
        href: '/activity'
      },
      {
        id: 'staff',
        label: 'Gestionar personal',
        description: 'Abrir controles de acceso, roles e inicio de sesión.',
        minRole: 'ADMIN',
        href: '/staff'
      },
      {
        id: 'export-inventory',
        label: 'Exportar inventario CSV',
        description: 'Descargar el estado actual del inventario del catálogo.',
        minRole: 'MANAGER',
        action: () => {
          window.location.assign('/api/inventory/export');
        }
      }
    ],
    []
  );

  const visibleActions = actions.filter((item) => ROLE_WEIGHT[role] >= ROLE_WEIGHT[item.minRole]);
  const filteredActions = visibleActions.filter((item) =>
    [item.label, item.description].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function runAction(action: QuickAction) {
    setOpen(false);
    setQuery('');

    if (action.action) {
      action.action();
      return;
    }

    if (action.href) {
      router.push(action.href);
    }
  }

  return (
    <>
      <div className="inline-flex items-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-white/80 bg-white/88 px-4 text-sm font-semibold text-stone-700 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-200 hover:text-stone-950"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M10 6H6a2 2 0 0 0-2 2v10h10a2 2 0 0 0 2-2v-4" />
              <path d="M14 4h6v6" />
              <path d="m20 4-9 9" />
            </svg>
          </span>
          <span>Acciones rápidas</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Ctrl K
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-stone-950/45 px-4 py-12"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto max-w-2xl rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-[0_40px_120px_-48px_rgba(28,25,23,0.55)] backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Accesos</div>
                <h2 className="mt-2 text-2xl font-black text-stone-950">Acciones rápidas</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Busca tareas operativas comunes y accede a ellas al instante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-500 hover:text-stone-900"
              >
                Esc
              </button>
            </div>

            <Input
              autoFocus
              placeholder="Busca acciones como venta, producto, proveedor o inventario..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="mt-4 space-y-2">
              {filteredActions.length ? (
                filteredActions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => runAction(item)}
                    className="flex w-full items-start justify-between gap-4 rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(245,245,244,0.88))] px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))]"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{item.label}</div>
                      <div className="mt-1 text-sm text-stone-500">{item.description}</div>
                    </div>
                    <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {item.minRole}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                  Ninguna acción rápida coincide con esa búsqueda.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
