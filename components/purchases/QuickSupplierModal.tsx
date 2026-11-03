'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';

type CreatedSupplier = { id: string; name: string };

export default function QuickSupplierModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (supplier: CreatedSupplier) => void;
}) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('Escribí el nombre del proveedor (mínimo 2 letras).');
      return;
    }

    setLoading(true);
    const response = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        contactName: contactName.trim() || null,
        phone: phone.trim() || null
      })
    });
    const data = await response.json().catch(() => ({ error: 'No se pudo crear el proveedor.' }));
    setLoading(false);

    if (!response.ok) {
      setError(
        response.status === 409
          ? 'Ya existe un proveedor con ese nombre.'
          : (data.error ?? 'No se pudo crear el proveedor.')
      );
      return;
    }

    onCreated({ id: data.supplier.id, name: data.supplier.name });
  }

  const fieldClass =
    'h-12 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 text-base outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Nuevo proveedor">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative grid w-full max-w-md gap-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-stone-900">Nuevo proveedor</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 hover:bg-stone-200"
          >
            ✕
          </button>
        </div>
        <label className="grid gap-1 text-sm font-semibold text-stone-600">
          Nombre *
          <input ref={nameRef} className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-stone-600">
          Teléfono
          <input className={fieldClass} type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-stone-600">
          Persona de contacto
          <input className={fieldClass} value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={120} />
        </label>
        <p className="text-xs text-stone-500">El resto de los datos se pueden completar después en Proveedores.</p>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" className="h-12 text-base" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="h-12 text-base" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar y usar'}
          </Button>
        </div>
      </form>
    </div>
  );
}

