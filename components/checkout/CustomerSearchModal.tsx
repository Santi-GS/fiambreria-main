'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { getCustomerDisplayName } from '@/lib/customers';
import { money } from '@/lib/format';
import type { Customer } from './types';

type CustomerSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomerId: string | null;
  currencySymbol: string;
  onSelectCustomer: (customer: Customer | null) => void;
};

function CustomerSearchDialog({
  onClose,
  customers,
  selectedCustomerId,
  currencySymbol,
  onSelectCustomer
}: Omit<CustomerSearchModalProps, 'isOpen'>) {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers.slice(0, 15);

    return customers.filter((c) => {
      const name = getCustomerDisplayName(c).toLowerCase();
      const phone = c.phone?.toLowerCase() ?? '';
      const email = c.email?.toLowerCase() ?? '';
      const business = c.businessName?.toLowerCase() ?? '';
      return name.includes(term) || phone.includes(term) || email.includes(term) || business.includes(term);
    });
  }, [customers, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900">Buscar o Asignar Cliente</h3>
              <p className="text-xs text-stone-500">Asigne un cliente para acumular puntos o ventas en cuenta corriente</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
            title="Cerrar [Escape]"
          >
            ✕
          </button>
        </div>

        {/* Search Input & Reset to Consumidor Final */}
        <div className="border-b border-stone-100 bg-stone-50/70 p-4 space-y-3">
          <Input
            ref={searchInputRef}
            placeholder="Buscar por nombre, teléfono, email o CUIT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 bg-white text-sm font-semibold"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onSelectCustomer(null);
                onClose();
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                !selectedCustomerId
                  ? 'bg-orange-600 text-white'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              ✓ Consumidor Final (Por Defecto)
            </button>
            <span className="text-xs text-stone-400">Total clientes: {customers.length}</span>
          </div>
        </div>

        {/* Customer Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => {
              const isSelected = selectedCustomerId === customer.id;
              const hasReceivable = Number(customer.receivableBalance) > 0;

              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(customer);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/70 shadow-2xs'
                      : 'border-stone-200 bg-white hover:border-sky-300 hover:bg-stone-50'
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-stone-900">{getCustomerDisplayName(customer)}</div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {customer.phone || 'Sin teléfono'} {customer.email ? `• ${customer.email}` : ''}
                    </div>
                  </div>

                  <div className="text-right text-xs space-y-0.5">
                    <div className="font-bold text-sky-700">Puntos: {customer.loyaltyBalance}</div>
                    {hasReceivable ? (
                      <div className="font-bold text-red-600">
                        Deuda: {money(customer.receivableBalance, currencySymbol)}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-stone-500">
              <p className="font-semibold text-stone-700">No se encontraron clientes.</p>
              <p className="mt-1 text-xs">Puede continuar como Consumidor Final o registrar el cliente en el módulo de clientes.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-stone-100 bg-stone-50/50 p-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar [Escape]
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerSearchModal({ isOpen, ...props }: CustomerSearchModalProps) {
  if (!isOpen) return null;
  return <CustomerSearchDialog {...props} />;
}
