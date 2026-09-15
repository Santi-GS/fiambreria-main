import type { PaymentMethod } from '@/lib/payments';

export type Category = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  barcode: string | null;
  sku: string | null;
  price: string;
  stockQty: number;
  categoryId: string | null;
  imageUrl: string | null;
  category?: { id: string; name: string } | null;
};

export type CartItem = Product & {
  qty: number;
};

export type Customer = {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  loyaltyBalance: number;
  receivableBalance: string;
  lastPurchaseAt: string | null;
};

export type PaymentLine = {
  id: string;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string;
};

export type ParkedSale = {
  id: string;
  shopId: string;
  cashierUserId: string;
  customerId: string | null;
  cashierName: string;
  cashierEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  title: string | null;
  quoteReference: string | null;
  type: 'SAVED_CART' | 'QUOTE';
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: 'HELD' | 'RESUMED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  resumedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: Array<{
    id: string;
    productId: string;
    productVariantId: string | null;
    productName: string;
    variantLabel: string | null;
    qty: number;
    unitPrice: string;
    lineTotal: string;
    createdAt: string;
  }>;
};

export type ScanFeedback = {
  tone: 'success' | 'error';
  message: string;
} | null;
