export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  unit: string;
  minimumInventoryThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  categoryId?: number | null;
  supplierId?: number | null;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  unit: string;
  minimumInventoryThreshold: number;
  active?: boolean;
}

export interface UpdateProductInput {
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  categoryId?: number | null;
  supplierId?: number | null;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  unit: string;
  minimumInventoryThreshold: number;
  active?: boolean;
}
