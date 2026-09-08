'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';

export default function AppSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="No se pudo cargar el espacio de trabajo"
      message="Esta sección de Vertex POS no pudo cargarse correctamente. Inténtalo de nuevo o vuelve al panel para repetir la acción."
      onReset={reset}
      homeHref="/dashboard"
      homeLabel="Volver al panel"
    />
  );
}
