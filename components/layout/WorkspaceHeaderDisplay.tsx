'use client';

import { usePathname } from 'next/navigation';
import { useWorkspaceHeader } from './WorkspaceHeaderContext';

const ROUTE_METADATA: Record<string, { title: string; subtitle?: string }> = {
  '/checkout': {
    title: 'Punto de venta',
    subtitle: 'Procesa ventas rápidamente, evita vender de más y genera transacciones listas para recibo.'
  },
  '/products': {
    title: 'Productos',
    subtitle: 'Gestiona productos, precios, estados de archivo y reposición sin omitir los controles de inventario.'
  },
  '/categories': {
    title: 'Categorías',
    subtitle: 'Organiza el catálogo sin romper las asignaciones de productos ni crear árboles de categorías duplicados.'
  },
  '/inventory': {
    title: 'Inventario',
    subtitle: 'Revisa el estado del stock y usa conteos, transferencias y devoluciones a proveedores para los flujos normales; reserva las correcciones para bajas excepcionales o saldos iniciales.'
  },
  '/transfers': {
    title: 'Transferencias entre sucursales',
    subtitle: 'Crea transferencias de inventario desde la sucursal activa, envíalas a tránsito y confirma la recepción solo en la sucursal de destino.'
  },
  '/purchases': {
    title: 'Compras',
    subtitle: 'Gestiona órdenes de compra, envíos, recepciones, facturación y pagos a proveedores sin perder precisión del inventario.'
  },
  '/suppliers': {
    title: 'Proveedores',
    subtitle: 'Mantenga los contactos de proveedores, facturas, saldos pendientes e historial de pagos visibles desde una sola pantalla operativa.'
  },
  '/customers': {
    title: 'Clientes',
    subtitle: 'Gestiona registros de clientes, historial de compras, saldos de fidelidad y cuentas por cobrar abiertas desde un solo espacio operativo.'
  },
  '/sales': {
    title: 'Historial de ventas',
    subtitle: 'Revisa transacciones, consulta detalles de pago y vuelve a abrir recibos sin salir del registro de auditoría.'
  },
  '/parked-sales': {
    title: 'Carritos guardados y cotizaciones',
    subtitle: 'Revisa cobros retenidos, filtra cotizaciones y carritos guardados, devuelve una cotización al cobro e imprime copias listas para el cliente.'
  },
  '/returns': {
    title: 'Devoluciones',
    subtitle: 'Controla reembolsos, anulaciones, cambios, motivos, aprobaciones y enlaces a recibos desde un único historial operativo.'
  },
  '/register/open': {
    title: 'Abrir caja',
    subtitle: 'Inicia una sesión de caja con un fondo inicial antes de aceptar pagos en efectivo.'
  },
  '/register/close': {
    title: 'Cerrar caja',
    subtitle: 'Cuenta el efectivo, compara el importe real con el esperado y cierra sesiones abiertas con un registro de auditoría completo.'
  },
  '/register/history': {
    title: 'Historial de caja',
    subtitle: 'Revisa sesiones abiertas y cerradas, aprueba cierres de cajeros, reabre turnos con un motivo e imprime resúmenes Z.'
  },
  '/reports': {
    title: 'Reportes del propietario',
    subtitle: 'Los reportes sensibles están limitados al acceso administrativo. Usa las pestañas para revisar ventas, inventario, ganancias y rendimiento de cajeros.'
  },
  '/reports/sales': {
    title: 'Reportes de ventas',
    subtitle: 'Revisa el rendimiento diario y mensual, los patrones horarios, la combinación de medios de pago y los productos con movimiento real.'
  },
  '/reports/inventory': {
    title: 'Reportes de inventario',
    subtitle: 'Revisa el valor actual de las existencias a costo y precio de venta, identifica el valor en riesgo por bajo stock y mantén visibles las existencias de baja rotación o inmovilizadas.'
  },
  '/reports/profit': {
    title: 'Reportes de ganancias',
    subtitle: 'La ganancia bruta usa la mejor base de costos disponible para cada fecha de venta: el historial coincidente cuando existe y, si no, el costo anterior o actual más antiguo del producto.'
  },
  '/reports/cashier': {
    title: 'Reportes de cajeros',
    subtitle: 'Revisa los ingresos gestionados, el comportamiento de los carritos, los reembolsos, las anulaciones y las sesiones de caja en una sola vista operativa.'
  },
  '/stock-counts': {
    title: 'Conteos de inventario',
    subtitle: 'Realiza conteos formales con soporte para conteo ciego, hojas por producto, aprobación previa al registro y un historial claro de variaciones.'
  },
  '/settings': {
    title: 'Configuración',
    subtitle: 'Gestiona la identidad de la sucursal, recibos, impuestos, valores predeterminados de inventario y pagos, y numeración de documentos desde una sola pantalla administrativa.'
  },
  '/staff': {
    title: 'Personal',
    subtitle: 'Gestiona cuentas de empleados, asignaciones de roles, accesos activos a tiendas y visibilidad de inicios de sesión.'
  },
  '/staff/new': {
    title: 'Agregar personal',
    subtitle: 'Cree una cuenta de empleado, elija la sucursal asignada y defina el rol inicial sin alterar el flujo de autenticación.'
  },
  '/activity': {
    title: 'Registro de actividad',
    subtitle: 'Revisa ventas, ajustes de inventario, compras, cambios del catálogo, tareas del trabajador y actualizaciones de configuración en un solo lugar.'
  }
};

function getFallback(pathname: string): { title: string; subtitle?: string } | null {
  if (ROUTE_METADATA[pathname]) {
    return ROUTE_METADATA[pathname];
  }

  if (pathname.startsWith('/sales/')) {
    if (pathname.endsWith('/refund')) {
      return {
        title: 'Reembolso / Cambio',
        subtitle: 'Procese reembolsos totales, reembolsos parciales, devoluciones por daños y cambios con aprobación de supervisor y un comprobante imprimible.'
      };
    }
    if (pathname.endsWith('/void')) {
      return {
        title: 'Anular venta',
        subtitle: 'Revierte la venta completa, repone el inventario, registra el medio de pago y conserva el registro de aprobación asociado al ajuste.'
      };
    }
    return { title: 'Detalle de venta', subtitle: 'Consulta los artículos, cobro y recibo de esta transacción.' };
  }

  if (pathname.startsWith('/stock-counts/')) {
    return {
      title: 'Conteo de inventario',
      subtitle: 'Registre los conteos físicos, compare los valores reales con las existencias esperadas y envíe las variaciones para su aprobación antes de actualizar el inventario.'
    };
  }

  if (pathname.startsWith('/staff/')) {
    return {
      title: 'Perfil de personal',
      subtitle: 'Revise este perfil de personal, ajuste la asignación actual, genere un enlace de restablecimiento e inspeccione la actividad de autenticación reciente.'
    };
  }

  return null;
}

export default function WorkspaceHeaderDisplay() {
  const pathname = usePathname();
  const { headerData } = useWorkspaceHeader();

  // On dashboard (has custom hero) and root, do not render header
  if (pathname === '/dashboard' || pathname === '/') {
    return null;
  }

  const isCurrentRouteData = headerData?.pathname === pathname;
  const fallback = getFallback(pathname);

  const title = (isCurrentRouteData && headerData?.title) ? headerData.title : fallback?.title;
  const subtitle = (isCurrentRouteData && headerData?.subtitle !== undefined) ? headerData.subtitle : fallback?.subtitle;

  if (!title) {
    return null;
  }

  return (
    <div className="min-w-0 max-w-3xl">
      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-800">
        Espacio de trabajo
      </div>
      <h1 className="mt-0.5 truncate text-2xl font-black tracking-tight text-stone-950 sm:text-[1.75rem]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-700 sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function WorkspaceActionsDisplay() {
  const pathname = usePathname();
  const { headerData } = useWorkspaceHeader();

  if (headerData?.pathname !== pathname || !headerData?.actions) {
    return null;
  }

  return <div className="flex flex-wrap items-center gap-2.5">{headerData.actions}</div>;
}
