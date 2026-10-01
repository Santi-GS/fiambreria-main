import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const apiErrorResponse = vi.fn();
const logActivity = vi.fn();
const buildCashSessionSummary = vi.fn();
const serializeRegisterSessionSummary = vi.fn();
const cashSessionFindFirst = vi.fn();
const cashMovementFindFirst = vi.fn();
const txCashMovementDelete = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/authz', () => ({
  requireRole
}));

vi.mock('@/lib/api', () => ({
  apiErrorResponse
}));

vi.mock('@/lib/activity', () => ({
  logActivity
}));

vi.mock('@/lib/register', () => ({
  buildCashSessionSummary,
  getCashMovementLabel: (type: string) => type
}));

vi.mock('@/lib/serializers/register', () => ({
  serializeRegisterSessionSummary
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cashSession: {
      findFirst: cashSessionFindFirst
    },
    cashMovement: {
      findFirst: cashMovementFindFirst
    },
    $transaction: transaction
  }
}));

describe('DELETE /api/register/sessions/[id]/movements', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireRole.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-1',
      role: 'CASHIER'
    });

    transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        cashMovement: {
          delete: txCashMovementDelete
        }
      })
    );

    apiErrorResponse.mockImplementation((_error: unknown, message: string) =>
      Response.json({ error: message }, { status: 500 })
    );
  });

  it('returns 400 when movementId is missing', async () => {
    const { DELETE } = await import('@/app/api/register/sessions/[id]/movements/route');
    const response = await DELETE(
      new Request('http://localhost/api/register/sessions/session-1/movements', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ id: 'session-1' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Debe especificar el ID del movimiento de efectivo a quitar.'
    });
  });

  it('returns 404 when session is not found', async () => {
    cashSessionFindFirst.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/register/sessions/[id]/movements/route');
    const response = await DELETE(
      new Request('http://localhost/api/register/sessions/session-1/movements?movementId=mov-1', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ id: 'session-1' }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Sesión de caja no encontrada.'
    });
  });

  it('returns 409 when session is already closed', async () => {
    cashSessionFindFirst.mockResolvedValue({
      id: 'session-1',
      shopId: 'shop-1',
      status: 'CLOSED',
      userId: 'user-1'
    });

    const { DELETE } = await import('@/app/api/register/sessions/[id]/movements/route');
    const response = await DELETE(
      new Request('http://localhost/api/register/sessions/session-1/movements?movementId=mov-1', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ id: 'session-1' }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Los movimientos de efectivo solo pueden eliminarse de una sesión de caja abierta.'
    });
  });

  it('deletes movement, logs activity and returns updated summary on success', async () => {
    cashSessionFindFirst.mockResolvedValue({
      id: 'session-1',
      shopId: 'shop-1',
      status: 'OPEN',
      userId: 'user-1',
      user: { name: 'Cajero Demo', email: 'cajero@ejemplo.com' }
    });

    cashMovementFindFirst.mockResolvedValue({
      id: 'mov-1',
      cashSessionId: 'session-1',
      shopId: 'shop-1',
      type: 'PAYOUT',
      amount: '500',
      note: 'Pago delivery erróneo'
    });

    buildCashSessionSummary.mockResolvedValue({
      expectedCash: 12000,
      salesCount: 5,
      timeline: []
    });

    serializeRegisterSessionSummary.mockReturnValue({
      expectedCash: '12000.00',
      salesCount: 5,
      timeline: []
    });

    const { DELETE } = await import('@/app/api/register/sessions/[id]/movements/route');
    const response = await DELETE(
      new Request('http://localhost/api/register/sessions/session-1/movements?movementId=mov-1', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ id: 'session-1' }) }
    );

    expect(response.status).toBe(200);
    expect(txCashMovementDelete).toHaveBeenCalledWith({ where: { id: 'mov-1' } });
    expect(logActivity).toHaveBeenCalled();
    expect(await response.json()).toEqual({
      ok: true,
      summary: {
        expectedCash: '12000.00',
        salesCount: 5,
        timeline: []
      }
    });
  });
});
