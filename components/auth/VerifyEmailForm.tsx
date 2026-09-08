'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';

export default function VerifyEmailForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function verifyEmail() {
    setLoading(true);
    setError('');
    setSuccess('');

    const response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json().catch(() => ({ error: 'No se puede verificar el correo.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'No se puede verificar el correo.');
      return;
    }

    setSuccess('Correo verificado correctamente. Ya puedes iniciar sesión.');
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
            V
          </div>
          <h1 className="mt-6 text-3xl font-black text-stone-950">Verificar correo</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Confirma el correo de esta cuenta antes de iniciar sesión en el espacio de trabajo del punto de venta.
          </p>

          {!token ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              A este enlace de verificación le falta un token.
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <Button type="button" className="w-full" disabled={loading || Boolean(success)} onClick={verifyEmail}>
                {loading ? 'Verificando correo...' : success ? 'Correo verificado' : 'Verificar correo'}
              </Button>
            </div>
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
