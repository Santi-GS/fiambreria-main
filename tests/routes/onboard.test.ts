import { ShopRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  logActivityMock,
  userShopFindManyMock,
  shopFindUniqueMock,
  transactionMock,
  txShopCreateMock,
  txUserShopCreateMock,
  txUserUpdateMock,
  txShopSettingCreateMock,
  txUnitCreateManyMock,
  txUnitFindFirstOrThrowMock,
  txInventoryReasonCreateManyMock,
  txCategoryCreateMock,
  txSupplierCreateMock,
  txProductCreateMock,
  txInventoryMovementCreateMock
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  logActivityMock: vi.fn(),
  userShopFindManyMock: vi.fn(),
  shopFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  txShopCreateMock: vi.fn(),
  txUserShopCreateMock: vi.fn(),
  txUserUpdateMock: vi.fn(),
  txShopSettingCreateMock: vi.fn(),
  txUnitCreateManyMock: vi.fn(),
  txUnitFindFirstOrThrowMock: vi.fn(),
  txInventoryReasonCreateManyMock: vi.fn(),
  txCategoryCreateMock: vi.fn(),
  txSupplierCreateMock: vi.fn(),
  txProductCreateMock: vi.fn(),
  txInventoryMovementCreateMock: vi.fn()
}));

vi.mock('@/auth', () => ({
  auth: authMock
}));

vi.mock('@/lib/activity', () => ({
  logActivity: logActivityMock
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userShop: {
      findMany: userShopFindManyMock
    },
    shop: {
      findUnique: shopFindUniqueMock
    },
    $transaction: transactionMock
  }
}));

import { POST } from '@/app/api/onboard/route';

const validPayload = {
  shopName: 'Sucursal Centro',
  legalBusinessName: 'Fiambreria Centro S.A.',
  posType: 'FOOD_BEVERAGE',
  timezone: 'America/Argentina/Buenos_Aires',
  currencyCode: 'ARS',
  currencySymbol: '$',
  taxMode: 'INCLUSIVE',
  taxRate: 21,
  lowStockThreshold: 5,
  receiptWidth: '80mm',
  categories: [],
  suppliers: [],
  products: []
};

describe('POST /api/onboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopFindUniqueMock.mockResolvedValue(null);
    txShopCreateMock.mockResolvedValue({ id: 'shop_new', name: 'Sucursal Centro', slug: 'sucursal-centro' });
    txUnitFindFirstOrThrowMock.mockResolvedValue({ id: 'uom_piece' });
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        shop: { create: txShopCreateMock },
        userShop: { create: txUserShopCreateMock },
        user: { update: txUserUpdateMock },
        shopSetting: { create: txShopSettingCreateMock },
        unitOfMeasure: { createMany: txUnitCreateManyMock, findFirstOrThrow: txUnitFindFirstOrThrowMock },
        inventoryReason: { createMany: txInventoryReasonCreateManyMock },
        category: { create: txCategoryCreateMock },
        supplier: { create: txSupplierCreateMock },
        product: { create: txProductCreateMock },
        inventoryMovement: { create: txInventoryMovementCreateMock }
      })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload)
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 403 when an existing cashier tries to create a new business', async () => {
    authMock.mockResolvedValue({ user: { id: 'user_cashier' } });
    userShopFindManyMock.mockResolvedValue([{ role: ShopRole.CASHIER, isActive: true }]);

    const response = await POST(
      new Request('http://localhost/api/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload)
      })
    );

    expect(response.status).toBe(403);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('creates a new business and switches defaultShopId for an existing manager', async () => {
    authMock.mockResolvedValue({ user: { id: 'user_manager' } });
    userShopFindManyMock.mockResolvedValue([{ role: ShopRole.MANAGER, isActive: true }]);

    const response = await POST(
      new Request('http://localhost/api/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload)
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.shop.id).toBe('shop_new');
    expect(txUserShopCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user_manager',
          shopId: 'shop_new',
          role: ShopRole.ADMIN,
          isActive: true
        })
      })
    );
    expect(txUserUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user_manager' },
      data: { defaultShopId: 'shop_new' }
    });
  });
});
