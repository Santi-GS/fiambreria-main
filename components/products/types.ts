export type Category = { id: string; name: string; parentId: string | null };

export type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };

export type Variant = {
  id: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  model: string | null;
  sku: string | null;
  barcode: string | null;
  priceOverride: string | null;
  costOverride: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductImage = {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
};

export type HistoryUser = { id: string; name: string | null; email: string };

export type PriceHistory = {
  id: string;
  previousPrice: string;
  newPrice: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};

export type CostHistory = {
  id: string;
  previousCost: string;
  newCost: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};

export type Product = {
  id: string;
  categoryId: string | null;
  baseUnitOfMeasureId: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  cost: string;
  price: string;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
  variants: Variant[];
  images: ProductImage[];
  priceHistory: PriceHistory[];
  costHistory: CostHistory[];
  batches: Array<{
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
  }>;
  category?: { id: string; name: string } | null;
};

export type VariantDraft = {
  color: string;
  size: string;
  flavor: string;
  model: string;
  sku: string;
  barcode: string;
  priceOverride: string;
  costOverride: string;
  isActive: boolean;
};

export type ImageDraft = {
  imageUrl: string;
  altText: string;
  sortOrder: string;
};

export type ProductFormData = {
  categoryId: string;
  baseUnitOfMeasureId: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  cost: string;
  price: string;
  stockQty: string;
  reorderPoint: string;
  trackBatches: boolean;
  trackExpiry: boolean;
  changeNote: string;
  uomConversions: Array<{ unitOfMeasureId: string; ratioToBase: string }>;
  variants: VariantDraft[];
  images: ImageDraft[];
  isActive: boolean;
};
