import React, { useState } from 'react';
import { X, Save, AlertCircle, Tag, CheckCircle2 } from 'lucide-react';
import { ProductCategory, CreateCategoryInput, UpdateCategoryInput } from '../../types/category';

interface CategoryFormModalProps {
  categoryToEdit?: ProductCategory | null;
  existingCategories: ProductCategory[];
  onClose: () => void;
  onSubmit: (data: CreateCategoryInput | UpdateCategoryInput) => Promise<void>;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  categoryToEdit,
  existingCategories,
  onClose,
  onSubmit,
}) => {
  const isEditing = Boolean(categoryToEdit);

  const [name, setName] = useState(categoryToEdit?.name || '');
  const [description, setDescription] = useState(categoryToEdit?.description || '');
  const [active, setActive] = useState<boolean>(categoryToEdit ? categoryToEdit.active : true);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const validate = (): boolean => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Category name is required and cannot be empty.');
      return false;
    }

    if (trimmedName.length < 2) {
      setError('Category name must be at least 2 characters.');
      return false;
    }

    // Check duplicate name among existing categories (case-insensitive & trimmed)
    const duplicate = existingCategories.find(
      (c) =>
        (!categoryToEdit || c.id !== categoryToEdit.id) &&
        c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      setError(`A category named "${trimmedName}" already exists. Category names must be unique.`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateCategoryInput | UpdateCategoryInput = {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        active,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product category. Please verify input.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {isEditing ? `Edit Category: ${categoryToEdit?.name}` : 'Add Product Category'}
              </h2>
              <p className="text-[11px] text-stone-500">
                {isEditing
                  ? 'Update category details and maintain associated product taxonomy'
                  : 'Define a new product classification for catalog & inventory'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Category Name */}
          <div>
            <label className="block font-medium text-stone-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Organic Produce, Artisanal Bakery, Beverages..."
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 placeholder:text-stone-400"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Unique, required identifier for reporting, invoice OCR matching, and POS catalog display.
            </p>
          </div>

          {/* Category Description */}
          <div>
            <label className="block font-medium text-stone-700 mb-1">
              Description <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the products grouped under this category..."
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 placeholder:text-stone-400 resize-none"
            />
          </div>

          {/* Status (Active / Inactive) */}
          <div className="pt-2 border-t border-stone-100">
            <label className="block font-medium text-stone-700 mb-1.5">Availability Status</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-md border border-stone-200 hover:bg-stone-50 flex-1">
                <input
                  type="radio"
                  name="activeStatus"
                  checked={active}
                  onChange={() => setActive(true)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Active</span>
                  </div>
                  <span className="text-[10px] text-stone-500">Available for assigning to products</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-md border border-stone-200 hover:bg-stone-50 flex-1">
                <input
                  type="radio"
                  name="activeStatus"
                  checked={!active}
                  onChange={() => setActive(false)}
                  className="text-stone-600 focus:ring-stone-500"
                />
                <div>
                  <div className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                    <span>Inactive</span>
                  </div>
                  <span className="text-[10px] text-stone-500">Preserved on existing items, hidden for new</span>
                </div>
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-stone-300 hover:bg-stone-100 rounded-md font-medium text-stone-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
