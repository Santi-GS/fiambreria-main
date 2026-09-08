export const SHOP_TYPE_OPTIONS = [
  {
    value: 'GENERAL_RETAIL',
    label: 'Comercio general',
    description: 'Controles de inventario simples con seguimiento opcional de lotes y caducidad.'
  },
  {
    value: 'GROCERY_CONVENIENCE',
    label: 'Supermercado / tienda de conveniencia',
    description: 'Inventario con caducidad y señales FEFO para artículos de alta rotación.'
  },
  {
    value: 'PHARMACY',
    label: 'Farmacia',
    description: 'Seguimiento de lotes y caducidad con ventanas de seguridad amplias para alertas tempranas.'
  },
  {
    value: 'FOOD_BEVERAGE',
    label: 'Alimentos / bebidas',
    description: 'Seguimiento de caducidad y soporte FEFO para consumibles y productos preparados.'
  },
  {
    value: 'COSMETICS_BEAUTY',
    label: 'Cosmética / belleza',
    description: 'Seguimiento de lotes y caducidad para productos de belleza sensibles a su vida útil.'
  },
  {
    value: 'MEDICAL_SUPPLIES',
    label: 'Suministros médicos',
    description: 'Inventario con caducidad y soporte de lotes para existencias clínicas.'
  },
  {
    value: 'HARDWARE',
    label: 'Ferretería',
    description: 'Controles de inventario directos con valores simples y seguimiento opcional.'
  }
] as const;

export type SupportedShopType = (typeof SHOP_TYPE_OPTIONS)[number]['value'];

type StarterProduct = {
  name: string;
  categoryName: string;
  sku: string;
  barcode: string;
  cost: number;
  price: number;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
};

type ShopTypeDefaults = {
  lowStockThreshold: number;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  fefoEnabled: boolean;
  expiryAlertDays: number;
  starterCategories: string[];
  starterSuppliers: Array<{
    name: string;
    contactName: string;
    phone: string;
  }>;
  starterProducts: StarterProduct[];
  hints: string[];
};

export const INVENTORY_REASON_PRESETS = [
  { code: 'DAMAGED', label: 'Dañado' },
  { code: 'EXPIRED', label: 'Caducado' },
  { code: 'LOST', label: 'Perdido' },
  { code: 'SHRINKAGE', label: 'Merma' },
  { code: 'OPENING_BALANCE_CORRECTION', label: 'Corrección de saldo inicial' },
  { code: 'SUPPLIER_RETURN', label: 'Devolución al proveedor' },
  { code: 'INTERNAL_USE', label: 'Uso interno' }
] as const;

const SHOP_TYPE_DEFAULTS: Record<SupportedShopType, ShopTypeDefaults> = {
  GENERAL_RETAIL: {
    lowStockThreshold: 5,
    batchTrackingEnabled: false,
    expiryTrackingEnabled: false,
    fefoEnabled: false,
    expiryAlertDays: 30,
    starterCategories: ['Mercancía general', 'Hogar', 'Accesorios'],
    starterSuppliers: [{ name: 'Proveedor comercial principal', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Bolsa reutilizable',
        categoryName: 'Accesorios',
        sku: 'RET-001',
        barcode: '',
        cost: 80,
        price: 149,
        stockQty: 18,
        reorderPoint: 4,
        trackBatches: false,
        trackExpiry: false
      }
    ],
    hints: [
      'El seguimiento de lotes y caducidad comienza como opcional para mantener simple el catálogo.',
      'Los ajustes con motivo ayudan a explicar claramente pérdidas, daños y uso interno.'
    ]
  },
  GROCERY_CONVENIENCE: {
    lowStockThreshold: 10,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 14,
    starterCategories: ['Bebidas', 'Botanas', 'Despensa'],
    starterSuppliers: [{ name: 'Distribuidor local', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Agua mineral 500 ml',
        categoryName: 'Bebidas',
        sku: 'GRC-001',
        barcode: '',
        cost: 10,
        price: 18,
        stockQty: 24,
        reorderPoint: 6,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'FEFO se prioriza para mostrar primero el inventario próximo a caducar.',
      'Las alertas de caducidad usan una ventana corta adecuada para tiendas de conveniencia.'
    ]
  },
  PHARMACY: {
    lowStockThreshold: 8,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 90,
    starterCategories: ['Medicamentos', 'Suplementos', 'Cuidado personal'],
    starterSuppliers: [{ name: 'Distribuidor farmacéutico', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Paracetamol 500 mg',
        categoryName: 'Medicamentos',
        sku: 'PHA-001',
        barcode: '',
        cost: 35,
        price: 58,
        stockQty: 20,
        reorderPoint: 5,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'El seguimiento de lotes y caducidad comienza activo para inventario sensible.',
      'Las ventanas de alerta son amplias para detectar antes los medicamentos próximos a caducar.'
    ]
  },
  FOOD_BEVERAGE: {
    lowStockThreshold: 8,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 7,
    starterCategories: ['Bebidas', 'Alimentos', 'Postres'],
    starterSuppliers: [{ name: 'Proveedor principal de alimentos', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Botella de café frío',
        categoryName: 'Bebidas',
        sku: 'FDB-001',
        barcode: '',
        cost: 55,
        price: 120,
        stockQty: 12,
        reorderPoint: 4,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'El seguimiento de caducidad y FEFO comienza activo para productos perecederos.',
      'Las ventanas cortas de alerta ayudan a reaccionar a la vida útil diaria.'
    ]
  },
  COSMETICS_BEAUTY: {
    lowStockThreshold: 6,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 60,
    starterCategories: ['Cuidado de la piel', 'Maquillaje', 'Cuidado capilar'],
    starterSuppliers: [{ name: 'Socio de suministros de belleza', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Limpiador facial hidratante',
        categoryName: 'Cuidado de la piel',
        sku: 'COS-001',
        barcode: '',
        cost: 120,
        price: 240,
        stockQty: 10,
        reorderPoint: 3,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'El soporte de lotes y caducidad está disponible para productos de belleza sensibles.',
      'La visibilidad FEFO ayuda a mover primero los lotes cosméticos más antiguos.'
    ]
  },
  MEDICAL_SUPPLIES: {
    lowStockThreshold: 8,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 120,
    starterCategories: ['Consumibles', 'Diagnóstico', 'Equipo de protección'],
    starterSuppliers: [{ name: 'Socio de suministros clínicos', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Gasas estériles',
        categoryName: 'Consumibles',
        sku: 'MED-001',
        barcode: '',
        cost: 65,
        price: 110,
        stockQty: 15,
        reorderPoint: 4,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'El control de inventario con caducidad comienza activo para suministros regulados.',
      'Las ventanas amplias de proximidad a caducidad ayudan a evitar desperdicios.'
    ]
  },
  HARDWARE: {
    lowStockThreshold: 5,
    batchTrackingEnabled: false,
    expiryTrackingEnabled: false,
    fefoEnabled: false,
    expiryAlertDays: 30,
    starterCategories: ['Fijaciones', 'Herramientas manuales', 'Material eléctrico'],
    starterSuppliers: [{ name: 'Proveedor comercial de ferretería', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Martillo de acero de 16 oz',
        categoryName: 'Herramientas manuales',
        sku: 'HDW-001',
        barcode: '',
        cost: 180,
        price: 320,
        stockQty: 8,
        reorderPoint: 2,
        trackBatches: false,
        trackExpiry: false
      }
    ],
    hints: [
      'El seguimiento de lotes y caducidad permanece opcional para productos duraderos.',
      'Los valores de inventario siguen siendo simples salvo que un producto necesite mayor trazabilidad.'
    ]
  }
};

const LEGACY_SHOP_TYPE_MAP: Record<string, SupportedShopType> = {
  RETAIL: 'GENERAL_RETAIL',
  COFFEE: 'FOOD_BEVERAGE',
  FOOD: 'FOOD_BEVERAGE',
  BUILDING_MATERIALS: 'HARDWARE',
  SERVICES: 'GENERAL_RETAIL'
};

export function normalizeShopType(shopType: string): SupportedShopType {
  if (shopType in SHOP_TYPE_DEFAULTS) {
    return shopType as SupportedShopType;
  }

  return LEGACY_SHOP_TYPE_MAP[shopType] ?? 'GENERAL_RETAIL';
}

export function getShopTypeDefaults(shopType: string) {
  return SHOP_TYPE_DEFAULTS[normalizeShopType(shopType)];
}
