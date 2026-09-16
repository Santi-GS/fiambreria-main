import { CashMovementType, CashSession, CashSessionStatus, Prisma } from '@prisma/client';
import { roundCurrency } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

type RegisterDb = Prisma.TransactionClient | typeof prisma;

export const CASH_PAYMENT_METHOD = 'Cash';

export async function acquireCashSessionOpenLock(
  db: RegisterDb,
  shopId: string,
  userId: string
) {
  const lockKey = `cash-session-open:${shopId}:${userId}`;

  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}

export type RegisterDenominationItem = {
  value: number;
  label: string;
};

export const DEFAULT_ARGENTINA_DENOMINATIONS: readonly RegisterDenominationItem[] = [
  { value: 20000, label: 'Billete de $20.000' },
  { value: 10000, label: 'Billete de $10.000' },
  { value: 2000, label: 'Billete de $2.000' },
  { value: 1000, label: 'Billete de $1.000' },
  { value: 500, label: 'Billete de $500' },
  { value: 200, label: 'Billete de $200' },
  { value: 100, label: 'Billete de $100' },
  { value: 50, label: 'Billete de $50' },
  { value: 20, label: 'Billete de $20' },
  { value: 10, label: 'Billete de $10' }
] as const;

export const REGISTER_DENOMINATIONS = DEFAULT_ARGENTINA_DENOMINATIONS;

export type RegisterDenominationSnapshot = Record<string, number>;

export type RegisterTimelineEntry = {
  id: string;
  type:
    | 'OPENING_FLOAT'
    | 'CASH_SALE'
    | 'REFUND'
    | 'PAYOUT'
    | 'CASH_DROP'
    | 'PETTY_CASH'
    | 'MANUAL_CORRECTION'
    | 'CLOSING_COUNT';
  label: string;
  occurredAt: Date;
  amount: number;
  note: string | null;
  reference: string | null;
  userName: string | null;
};

export type RegisterSessionSummary = {
  expectedCash: number;
  salesCount: number;
  grossSalesTotal: number;
  cashSalesTotal: number;
  refundCashTotal: number;
  paymentBreakdown: Array<{ method: string; amount: number }>;
  movementTotals: Record<CashMovementType, number>;
  movements: Array<{
    id: string;
    type: CashMovementType;
    amount: number;
    note: string | null;
    createdAt: Date;
    createdByName: string | null;
  }>;
  timeline: RegisterTimelineEntry[];
};

export function getDenominationKey(value: number) {
  return value.toFixed(2);
}

export function createEmptyDenominationSnapshot(
  denominations: readonly RegisterDenominationItem[] = REGISTER_DENOMINATIONS
): RegisterDenominationSnapshot {
  return Object.fromEntries(
    denominations.map((entry) => [getDenominationKey(entry.value), 0])
  );
}

export function normalizeDenominationSnapshot(
  input: unknown,
  denominations: readonly RegisterDenominationItem[] = REGISTER_DENOMINATIONS
): RegisterDenominationSnapshot {
  const base = createEmptyDenominationSnapshot(denominations);

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return base;
  }

  const record = input as Record<string, unknown>;

  for (const denomination of denominations) {
    const key = getDenominationKey(denomination.value);
    const rawValue = record[key];
    const parsed = Number(rawValue);
    base[key] = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }

  for (const [key, rawValue] of Object.entries(record)) {
    const numKey = Number(key);
    if (Number.isFinite(numKey) && numKey > 0) {
      const normalizedKey = getDenominationKey(numKey);
      if (!(normalizedKey in base)) {
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed) && parsed > 0) {
          base[normalizedKey] = Math.floor(parsed);
        }
      }
    }
  }

  return base;
}

export function calculateDenominationTotal(
  snapshot: RegisterDenominationSnapshot,
  denominations?: readonly RegisterDenominationItem[]
) {
  if (denominations && denominations.length > 0) {
    let sum = 0;
    for (const denomination of denominations) {
      const key = getDenominationKey(denomination.value);
      sum += denomination.value * (snapshot[key] ?? 0);
    }
    return roundCurrency(sum);
  }

  return roundCurrency(
    Object.entries(snapshot).reduce((sum, [key, count]) => {
      const value = Number(key);
      const parsedCount = Number(count);
      if (Number.isFinite(value) && value > 0 && Number.isFinite(parsedCount) && parsedCount > 0) {
        return sum + value * parsedCount;
      }
      return sum;
    }, 0)
  );
}

export function getCashMovementLabel(type: CashMovementType) {
  switch (type) {
    case 'CASH_DROP':
      return 'Cash drop';
    case 'PETTY_CASH':
      return 'Petty cash';
    case 'MANUAL_CORRECTION':
      return 'Manual correction';
    default:
      return 'Payout';
  }
}

export function getCashMovementSignedAmount(
  type: CashMovementType,
  amount: number
) {
  return type === 'MANUAL_CORRECTION' ? roundCurrency(amount) : roundCurrency(amount * -1);
}

export function isOpenCashSessionStatus(status: CashSessionStatus) {
  return status === 'OPEN';
}

export async function getActiveCashSession(db: RegisterDb, shopId: string, userId: string) {
  return db.cashSession.findFirst({
    where: {
      shopId,
      userId,
      status: 'OPEN'
    },
    orderBy: { openedAt: 'desc' }
  });
}

export async function getActiveCashSessionsForShop(db: RegisterDb, shopId: string) {
  return db.cashSession.findMany({
    where: {
      shopId,
      status: 'OPEN'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      movements: {
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { openedAt: 'asc' }
  });
}

function getTimelineUserName(user?: { name: string | null; email: string } | null) {
  return user?.name ?? user?.email ?? null;
}

export async function buildCashSessionSummary(
  db: RegisterDb,
  session: Pick<
    CashSession,
    | 'id'
    | 'shopId'
    | 'userId'
    | 'openedAt'
    | 'openingFloat'
    | 'closedAt'
    | 'closingActual'
  >,
  asOf = session.closedAt ?? new Date()
): Promise<RegisterSessionSummary> {
  const baseSaleFilter = {
    shopId: session.shopId,
    cashierUserId: session.userId,
    status: 'COMPLETED' as const,
    createdAt: {
      gte: session.openedAt,
      lte: asOf
    }
  };

  const [sales, refunds, movements] = await Promise.all([
    db.sale.findMany({
      where: baseSaleFilter,
      include: {
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    }),
    db.refundPayment.findMany({
      where: {
        method: CASH_PAYMENT_METHOD,
        saleAdjustment: {
          shopId: session.shopId,
          createdByUserId: session.userId,
          createdAt: {
            gte: session.openedAt,
            lte: asOf
          }
        }
      },
      include: {
        saleAdjustment: {
          select: {
            id: true,
            adjustmentNumber: true,
            createdAt: true,
            createdByUser: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    }),
    db.cashMovement.findMany({
      where: {
        cashSessionId: session.id
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
  ]);

  const paymentTotals = new Map<string, number>();
  const timeline: RegisterTimelineEntry[] = [
    {
      id: `opening-${session.id}`,
      type: 'OPENING_FLOAT',
      label: 'Opening float',
      occurredAt: session.openedAt,
      amount: Number(session.openingFloat),
      note: null,
      reference: null,
      userName: null
    }
  ];

  let grossSalesTotal = 0;
  let cashSalesTotal = 0;

  for (const sale of sales) {
    grossSalesTotal += Number(sale.totalAmount);

    if (sale.payments.length) {
      for (const payment of sale.payments) {
        paymentTotals.set(
          payment.method,
          roundCurrency((paymentTotals.get(payment.method) ?? 0) + Number(payment.amount))
        );
      }
    } else {
      paymentTotals.set(
        sale.paymentMethod,
        roundCurrency((paymentTotals.get(sale.paymentMethod) ?? 0) + Number(sale.totalAmount))
      );
    }

    const cashReceived = sale.payments.length
      ? sale.payments
          .filter((payment) => payment.method === CASH_PAYMENT_METHOD)
          .reduce((sum, payment) => sum + Number(payment.amount), 0)
      : sale.paymentMethod === CASH_PAYMENT_METHOD
        ? Number(sale.totalAmount)
        : 0;
    const cashNet = roundCurrency(cashReceived - Number(sale.changeDue));

    if (cashNet > 0) {
      cashSalesTotal = roundCurrency(cashSalesTotal + cashNet);
      timeline.push({
        id: `sale-${sale.id}`,
        type: 'CASH_SALE',
        label: 'Cash sale',
        occurredAt: sale.createdAt,
        amount: cashNet,
        note: sale.customerName ?? null,
        reference: sale.saleNumber,
        userName: sale.cashierName ?? null
      });
    }
  }

  let refundCashTotal = 0;

  for (const refund of refunds) {
    const amount = roundCurrency(Number(refund.amount));
    refundCashTotal = roundCurrency(refundCashTotal + amount);
    timeline.push({
      id: `refund-${refund.id}`,
      type: 'REFUND',
      label: 'Cash refund',
      occurredAt: refund.createdAt,
      amount: amount * -1,
      note: null,
      reference: refund.saleAdjustment.adjustmentNumber,
      userName: getTimelineUserName(refund.saleAdjustment.createdByUser)
    });
  }

  const movementTotals: Record<CashMovementType, number> = {
    PAYOUT: 0,
    CASH_DROP: 0,
    PETTY_CASH: 0,
    MANUAL_CORRECTION: 0
  };

  for (const movement of movements) {
    const amount = roundCurrency(Number(movement.amount));
    movementTotals[movement.type] = roundCurrency(movementTotals[movement.type] + amount);
    timeline.push({
      id: `movement-${movement.id}`,
      type: movement.type,
      label: getCashMovementLabel(movement.type),
      occurredAt: movement.createdAt,
      amount: getCashMovementSignedAmount(movement.type, amount),
      note: movement.note,
      reference: null,
      userName: movement.createdByUser.name ?? movement.createdByUser.email
    });
  }

  const expectedCash = roundCurrency(
    Number(session.openingFloat) +
      cashSalesTotal -
      refundCashTotal -
      movementTotals.PAYOUT -
      movementTotals.CASH_DROP -
      movementTotals.PETTY_CASH +
      movementTotals.MANUAL_CORRECTION
  );

  if (session.closingActual !== null && session.closingActual !== undefined) {
    timeline.push({
      id: `closing-${session.id}`,
      type: 'CLOSING_COUNT',
      label: 'Closing count',
      occurredAt: session.closedAt ?? asOf,
      amount: Number(session.closingActual),
      note: null,
      reference: null,
      userName: null
    });
  }

  timeline.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

  return {
    expectedCash,
    salesCount: sales.length,
    grossSalesTotal: roundCurrency(grossSalesTotal),
    cashSalesTotal,
    refundCashTotal,
    paymentBreakdown: Array.from(paymentTotals.entries())
      .map(([method, amount]) => ({ method, amount }))
      .sort((left, right) => right.amount - left.amount),
    movementTotals,
    movements: movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: Number(movement.amount),
      note: movement.note,
      createdAt: movement.createdAt,
      createdByName: movement.createdByUser.name ?? movement.createdByUser.email
    })),
    timeline
  };
}

export async function computeClosingExpectedCash(
  db: RegisterDb,
  session: Pick<
    CashSession,
    | 'id'
    | 'shopId'
    | 'userId'
    | 'openedAt'
    | 'openingFloat'
    | 'closedAt'
    | 'closingActual'
  >,
  closingAt: Date
) {
  const summary = await buildCashSessionSummary(db, session, closingAt);
  return summary.expectedCash;
}

export function appendRegisterNotes(
  existingNotes: string | null | undefined,
  nextNotes: string | null | undefined
) {
  const existing = existingNotes?.trim() ?? '';
  const next = nextNotes?.trim() ?? '';

  if (!existing) {
    return next || null;
  }

  if (!next) {
    return existing;
  }

  return `${existing}\n\n${next}`;
}
