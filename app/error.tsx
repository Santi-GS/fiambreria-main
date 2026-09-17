'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <ErrorState
          title="Fiambrería Costanera POS encontró un error inesperado"
          message="No pudimos terminar de cargar esta página. Inténtalo de nuevo y vuelve al panel si el problema continúa."
          onReset={reset}
        />
      </body>
    </html>
  );
}
