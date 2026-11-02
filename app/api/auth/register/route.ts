import { NextResponse } from 'next/server';

export async function POST(_request: Request) {
  void _request;
  return NextResponse.json(
    {
      error:
        'El registro público de cuentas está deshabilitado. Solicita acceso al administrador del sistema.'
    },
    { status: 403 }
  );
}
