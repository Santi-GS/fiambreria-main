'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';

export default function AuthSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="No se pudo cargar la pantalla de autenticación"
      message="No pudimos terminar de cargar el acceso a la cuenta. Inténtalo de nuevo y vuelve a la pantalla de inicio de sesión si es necesario."
      onReset={reset}
      homeHref="/login"
      homeLabel="Volver a iniciar sesión"
    />
  );
}
