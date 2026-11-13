export type Supplier = { id: string; name: string };
export type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };

export type Product = {
  id: string;
  name: string;
  cost: string;
  stockQty: number;
  barcode?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  baseUnitOfMeasureId: string | null;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
};

export type PurchaseItem = {
  id: string;
  productId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  productName: string;
  qty: number;
  unitCost: string;
  lineTotal: string;
};

export type PurchaseReceiptItem = {
  id: string;
  purchaseItemId: string;
  productId: string;
  qtyReceived: number;
  createdAt: string;
  product: { id: string; name: string };
};

export type PurchaseReceipt = {
  id: string;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
  receivedByUser: { id: string; name: string | null; email: string };
  items: PurchaseReceiptItem[];
};

export type SupplierPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  paidAt: string;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string };
};

export type AccountsPayableEntry = {
  id: string;
  amountDue: string;
  amountPaid: string;
  balance: string;
  status: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplierInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: SupplierPayment[];
  payableEntry?: AccountsPayableEntry | null;
};

export type Purchase = {
  id: string;
  purchaseNumber: string;
  totalAmount: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  supplier: { name: string };
  items: PurchaseItem[];
  receipts?: PurchaseReceipt[];
  supplierInvoice?: SupplierInvoice | null;
};

export type Line = {
  productId: string;
  productName: string;
  unitOfMeasureId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  qty: number;
  unitCost: number;
};

export type ReceiptDraft = {
  receivedAt: string;
  notes: string;
  items: Record<string, string>;
};

export type InvoiceDraft = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  notes: string;
};

export type PaymentDraft = {
  method: string;
  amount: string;
  referenceNumber: string;
  paidAt: string;
};
