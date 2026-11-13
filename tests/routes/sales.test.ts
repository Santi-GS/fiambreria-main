import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const apiErrorResponse = vi.fn();
const logActivity = vi.fn();
const getActiveCashSession = vi.fn();
const getNextDocumentNumber = vi.fn();
const shopSettingFindUnique = vi.fn();
const productFindMany = vi.fn();
const saleFindFirst = vi.fn();
const transaction = vi.fn();
const txProductUpdateMany = vi.fn();
const txProductFindFirst = vi.fn();
const txSaleCreate = vi.fn();
const txInventoryMovementCreate = vi.fn();

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
  CASH_PAYMENT_METHOD: 'Cash',
  getActiveCashSession
}));

vi.mock('@/lib/document-sequence', () => ({
  getNextDocumentNumber
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shopSetting: { findUnique: shopSettingFindUnique },
    product: { findMany: productFindMany },
    sale: { findFirst: saleFindFirst },
    $transaction: transaction
  }
}));

function makeSalePayload(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: 'prod-1', qty: 2 }],
    payments: [{ method: 'Cash', amount: 200 }],
    discountAmount: 0,
    isCreditSale: false,
    ...overrides
  };
}

describe('POST /api/sales', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireRole.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-1',
      session: { user: { name: 'Cajero', email: 'cajero@test.local' } }
    });
    getActiveCashSession.mockResolvedValue({ id: 'session-1' });
    shopSettingFindUnique.mockResolvedValue({
      taxRate: 0,
      taxMode: 'EXCLUSIVE',
      salePrefix: 'SAL',
      receiptPrefix: 'RCP',
      timezone: 'America/Argentina/Buenos_Aires'
    });
    productFindMany.mockResolvedValue([
      {
        id: 'prod-1',
        name: 'Queso Tybo',
        price: 100,
        stockQty: 5,
        isActive: true,
        variants: [],
        baseUnitOfMeasure: { code: 'UNIT' }
      }
    ]);
    saleFindFirst.mockResolvedValue(null);
    getNextDocumentNumber.mockResolvedValueOnce('SAL-20261113-0001').mockResolvedValueOnce('RCP-20261113-0001');
    logActivity.mockResolvedValue(undefined);
    apiErrorResponse.mockImplementation((_error: unknown, message: string) =>
      Response.json({ error: message }, { status: 500 })
    );

    txSaleCreate.mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'SAL-20261113-0001',
      receiptNumber: 'RCP-20261113-0001',
      subtotal: { toString: () => '200' },
      taxAmount: { toString: () => '0' },
      discountAmount: { toString: () => '0' },
      totalAmount: { toString: () => '200' },
      changeDue: { toString: () => '0' },
      createdAt: new Date('2026-11-13T04:00:00Z'),
      items: [{ unitPrice: { toString: () => '100' }, lineTotal: { toString: () => '200' } }],
      payments: [{ amount: { toString: () => '200' }, createdAt: new Date('2026-11-13T04:00:00Z') }]
    });
    txProductUpdateMany.mockResolvedValue({ count: 1 });
    txInventoryMovementCreate.mockResolvedValue({ id: 'mov-1' });
    transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        sale: { create: txSaleCreate },
        product: { updateMany: txProductUpdateMany, findFirst: txProductFindFirst },
        inventoryMovement: { create: txInventoryMovementCreate }
      })
    );
  });

  it('returns 409 OFFLINE_SYNC_CONFLICT if atomic stock decrement fails inside transaction', async () => {
    txProductUpdateMany.mockResolvedValue({ count: 0 });
    txProductFindFirst.mockResolvedValue({ stockQty: 1, isActive: true });

    const { POST } = await import('@/app/api/sales/route');
    const response = await POST(
      new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(makeSalePayload())
      })
    );

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.code).toBe('OFFLINE_SYNC_CONFLICT');
    expect(json.conflicts[0].type).toBe('INSUFFICIENT_STOCK');
    expect(json.conflicts[0].availableQty).toBe(1);
  });

  it('returns alreadySynced sale when concurrent clientRequestId hits P2002', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.2'
    });
    transaction.mockRejectedValueOnce(p2002);
    saleFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sale-existing',
        saleNumber: 'SAL-20261113-0001',
        receiptNumber: 'RCP-20261113-0001',
        subtotal: { toString: () => '200' },
        taxAmount: { toString: () => '0' },
        discountAmount: { toString: () => '0' },
        totalAmount: { toString: () => '200' },
        changeDue: { toString: () => '0' },
        createdAt: new Date('2026-11-13T04:00:00Z'),
        items: [],
        payments: []
      });

    const { POST } = await import('@/app/api/sales/route');
    const response = await POST(
      new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(makeSalePayload({ clientRequestId: 'req-concurrent-1' }))
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.alreadySynced).toBe(true);
    expect(json.sale.id).toBe('sale-existing');
  });
});
