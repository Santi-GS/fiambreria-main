import { prisma } from './prisma';

export const DEFAULT_UNITS_OF_MEASURE = [
  { code: 'PIECE', name: 'Pieza', isBase: true },
  { code: 'KG', name: 'Kilogramo', isBase: false },
  { code: 'BOX', name: 'Caja', isBase: false },
  { code: 'CARTON', name: 'Cartón', isBase: false },
  { code: 'PACK', name: 'Paquete', isBase: false }
] as const;

/** Unit codes that represent weight-based (pesable) products */
export const WEIGHT_UNIT_CODES = ['KG'] as const;

/** Check if a unit code represents a weighted product */
export function isWeightUnit(code: string | null | undefined): boolean {
  return code ? WEIGHT_UNIT_CODES.includes(code.toUpperCase() as (typeof WEIGHT_UNIT_CODES)[number]) : false;
}

export function normalizeUomCode(value: string) {
  return value.trim().toUpperCase();
}

export async function ensureUnitsOfMeasure(shopId: string) {
  await prisma.$transaction(
    DEFAULT_UNITS_OF_MEASURE.map((unit) =>
      prisma.unitOfMeasure.upsert({
        where: {
          shopId_code: {
            shopId,
            code: unit.code
          }
        },
        update: {
          name: unit.name,
          isBase: unit.isBase,
          isActive: true
        },
        create: {
          shopId,
          code: unit.code,
          name: unit.name,
          isBase: unit.isBase,
          isActive: true
        }
      })
    )
  );

  return prisma.unitOfMeasure.findMany({
    where: {
      shopId,
      isActive: true
    },
    orderBy: [{ isBase: 'desc' }, { name: 'asc' }]
  });
}

export function summarizeConversions(
  conversions: Array<{ unitName: string; ratioToBase: number }>,
  baseUnitName: string | null | undefined
) {
  if (!conversions.length || !baseUnitName) {
    return 'Sin conversiones de unidades';
  }

  return conversions
    .map((conversion) => `1 ${conversion.unitName.toLowerCase()} = ${conversion.ratioToBase} ${baseUnitName.toLowerCase()}${conversion.ratioToBase === 1 ? '' : 's'}`)
    .join(' • ');
}
