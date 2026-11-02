import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/auth/register/route';

describe('POST /api/auth/register', () => {
  it('returns 403 because public account registration is disabled', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'strongpass123',
          confirmPassword: 'strongpass123'
        })
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error:
        'El registro público de cuentas está deshabilitado. Solicita acceso al administrador del sistema.'
    });
  });
});
