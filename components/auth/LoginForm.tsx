'use client';

import { useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

function getSafeCallbackUrl(callbackUrl: string | null) {
  if (!callbackUrl) {
    return '/dashboard';
  }

  if (callbackUrl.startsWith('/')) {
    return callbackUrl;
  }

  try {
    const url = new URL(callbackUrl);
    return `${url.pathname}${url.search}${url.hash}` || '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export default function LoginForm({
  inactiveAccess,
  callbackUrl
}: {
  inactiveAccess: boolean;
  callbackUrl: string | null;
}) {
  const showDevAutofill = process.env.NODE_ENV !== 'production';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const destination = getSafeCallbackUrl(callbackUrl);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: destination
    });
    setLoading(false);

    if (result?.error) {
      setError('El correo electrónico o la contraseña no son válidos.');
      return;
    }

    const session = await getSession();
    router.push(session?.user?.defaultShopId ? destination : '/onboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-2">
        <div className="hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-10 text-white shadow-xl md:block">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">V</div>
          <h1 className="text-4xl font-black leading-tight">Inicia sesión para gestionar tu tienda.</h1>
          <p className="mt-4 text-base leading-7 text-emerald-50">Usa tu cuenta empresarial para acceder de forma segura al punto de venta, inventario, reportes y operaciones de sucursal.</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <h2 className="text-3xl font-black text-stone-900">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-stone-500">Usa el correo y la contraseña asignados a tu cuenta.</p>
          {inactiveAccess ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              El acceso a tu tienda está inactivo. Contacta a un administrador si aún necesitas acceso.
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800">Email</label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-stone-800">Contraseña</label>
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {showDevAutofill ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                <div className="font-semibold">Ayuda de desarrollo</div>
                <div className="mt-1 text-sky-800">Las credenciales de demostración solo están disponibles en compilaciones que no son de producción.</div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('owner@vertexpos.local');
                    setPassword('password123');
                  }}
                  className="mt-3 font-semibold text-sky-700 hover:text-sky-900"
                >
                  Completar credenciales locales de demostración
                </button>
              </div>
            ) : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Iniciando sesión...' : 'Iniciar sesión'}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">¿No tienes una cuenta? <button type="button" onClick={() => router.push('/signup')} className="font-semibold text-emerald-600 hover:text-emerald-700">Crear una</button></p>
        </div>
      </div>
    </main>
  );
}
