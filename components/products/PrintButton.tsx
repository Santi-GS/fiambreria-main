'use client';

import Button from '@/components/ui/Button';

export default function PrintButton({ label = 'Imprimir etiquetas' }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
