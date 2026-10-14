import { Product } from './product';

export interface CartItem {
  id: number; // product.id
  product: Product;
  quantity: number;
  unitPrice: number;
  taxRate: number; // percentage or rate e.g. 5 for 5% or 0.05
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface CartTotals {
  itemCount: number;
  lineCount: number;
  subtotal: number;
  tax: number;
  total: number;
}
