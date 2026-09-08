'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/reports', label: 'Resumen' },
  { href: '/reports/sales', label: 'Ventas' },
  { href: '/reports/inventory', label: 'Inventario' },
  { href: '/reports/profit', label: 'Ganancias' },
  { href: '/reports/cashier', label: 'Caja' }
] as const;

export default function ReportsNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
