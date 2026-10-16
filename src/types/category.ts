export interface ProductCategory {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  active?: boolean;
}
