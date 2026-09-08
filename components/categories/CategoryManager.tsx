'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  _count?: { products: number; children: number };
};

export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const parents = useMemo(() => categories.filter((item) => !item.parentId), [categories]);

  async function addCategory() {
    setError('');
    setSuccess('');

    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId || null })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo crear la categoría.' }));
    if (!response.ok) {
      setError(data.error ?? 'No se pudo crear la categoría.');
      return;
    }

    setCategories((current) => [data.category, ...current]);
    setName('');
    setParentId('');
    setSuccess('Categoría creada correctamente.');
  }

  async function toggleActive(category: Category) {
    const confirmed = window.confirm(`${category.isActive ? '¿Archivar' : '¿Restaurar'} ${category.name}?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isActive: !category.isActive,
        name: category.name,
        parentId: category.parentId
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.category) {
      setError(data?.error ?? 'No se pudo actualizar la categoría.');
      return;
    }

    setCategories((current) =>
      current.map((entry) => (entry.id === category.id ? data.category : entry))
    );
  }

  async function removeCategory(category: Category) {
    const confirmed = window.confirm(`¿Eliminar ${category.name}? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({ error: 'No se pudo eliminar la categoría.' }));

    if (!response.ok) {
      setError(data.error ?? 'No se pudo eliminar la categoría.');
      return;
    }

    setCategories((current) => current.filter((entry) => entry.id !== category.id));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h2 id="new-category" className="text-xl font-black text-stone-900">Crear categoría</h2>
        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold">Nombre de categoría</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="p. ej. Refrescos" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">Categoría principal</label>
            <select
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">Sin categoría principal</option>
              {parents.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <Button type="button" onClick={addCategory}>Guardar categoría</Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Lista de categorías</h2>
        <div className="mt-4 space-y-3">
          {categories.length ? (
            categories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-stone-900">{category.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={category.isActive ? 'emerald' : 'stone'}>
                        {category.isActive ? 'Activa' : 'Archivada'}
                      </Badge>
                      <Badge tone="blue">{category.parentId ? 'Subcategoría' : 'Nivel superior'}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-stone-500">
                      {category._count?.products ?? 0} producto(s) / {category._count?.children ?? 0} subcategoría(s)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => toggleActive(category)}>
                      {category.isActive ? 'Archivar' : 'Restaurar'}
                    </Button>
                    <Button type="button" variant="danger" onClick={() => removeCategory(category)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              Aún no hay categorías. Crea una para mantener organizado el catálogo de productos.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
