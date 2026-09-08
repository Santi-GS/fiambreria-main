'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password,
        confirmPassword
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se puede restablecer la contraseña.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? 'No se puede restablecer la contraseña.');
      return;
    }

    setSuccess('La contraseña se actualizó correctamente. Ya puedes iniciar sesión con la nueva contraseña.');
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
            V
          </div>
          <h1 className="mt-6 text-3xl font-black text-stone-950">Restablecer contraseña</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Usa el enlace de restablecimiento para definir una nueva contraseña para tu cuenta.
          </p>

          {!token ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              A este enlace de restablecimiento le falta un token.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-800">Nueva contraseña</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-800">Confirmar contraseña</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Actualizando contraseña...' : 'Definir nueva contraseña'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-stone-600">
            <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
