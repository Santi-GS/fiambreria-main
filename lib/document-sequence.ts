import { DocumentSequenceType, Prisma } from '@prisma/client';

function formatDateKey(date = new Date(), timeZone?: string | null) {
  if (timeZone?.trim()) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone.trim(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);

      const year = parts.find((part) => part.type === 'year')?.value;
      const month = parts.find((part) => part.type === 'month')?.value;
      const day = parts.find((part) => part.type === 'day')?.value;

      if (year && month && day) {
        return `${year}${month}${day}`;
      }
    } catch {
      // Fall back to server local date when timeZone is invalid
    }
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
}

function sanitizePrefix(prefix: string, fallback: string) {
  const normalized = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return normalized || fallback;
}

export async function getNextDocumentNumber(
  tx: Prisma.TransactionClient,
  {
    shopId,
    type,
    prefix,
    timeZone
  }: {
    shopId: string;
    type: DocumentSequenceType;
    prefix: string;
    timeZone?: string | null;
  }
) {
  const safePrefix = sanitizePrefix(prefix, type.slice(0, 3));
  const dateKey = formatDateKey(new Date(), timeZone);

  const sequence = await tx.documentSequence.upsert({
    where: {
      shopId_type_dateKey: {
        shopId,
        type,
        dateKey
      }
    },
    update: {
      value: {
        increment: 1
      }
    },
    create: {
      shopId,
      type,
      dateKey,
      value: 1
    },
    select: {
      value: true
    }
  });

  return `${safePrefix}-${dateKey}-${String(sequence.value).padStart(4, '0')}`;
}
