import React, { useState } from 'react';
import { Category } from '../../types';
import { Plus, Edit3, Trash2, FolderTree } from 'lucide-react';

interface CategoriesListProps {
  categories: Category[];
  onSaveCategory: (categoryData: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
}

export const CategoriesList: React.FC<CategoriesListProps> = ({
  categories,
  onSaveCategory,
  onDeleteCategory
}) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [slug, setSlug] = useState('');
  const [sortOrder, setSortOrder] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setNameAr('');
    setNameEn('');
    setSlug('');
    setSortOrder(categories.length + 1);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setNameAr(cat.name_ar);
    setNameEn(cat.name_en);
    setSlug(cat.slug);
    setSortOrder(cat.sort_order);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveCategory({
      id: editingCategory?.id,
      name_ar: nameAr,
      name_en: nameEn,
      slug: slug || nameEn.toLowerCase().replace(/\s+/g, '-'),
      sort_order: Number(sortOrder)
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-start font-cairo">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-white">إدارة تصنيفات الـ Workflows</h2>
          <p className="text-xs text-slate-400">تصنيف المنتجات والسيناريوهات المتاحة في المتجر</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>تصنيف جديد</span>
        </button>
      </div>

      <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
        <table className="w-full text-xs text-start">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-3.5">الترتيب</th>
              <th className="p-3.5">الاسم بالعربية</th>
              <th className="p-3.5">الاسم بالإنجليزية</th>
              <th className="p-3.5">الـ Slug</th>
              <th className="p-3.5 text-end">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {categories.map(c => (
              <tr key={c.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 font-mono text-slate-400">{c.sort_order}</td>
                <td className="p-3.5 font-bold text-white">{c.name_ar}</td>
                <td className="p-3.5">{c.name_en}</td>
                <td className="p-3.5 font-mono text-slate-500">{c.slug}</td>
                <td className="p-3.5 text-end">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="p-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-300"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteCategory(c.id)}
                      className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-heading font-extrabold text-lg text-white">
              {editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
            </h3>

            <div className="space-y-3 text-start">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">الاسم بالعربية</label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={e => setNameAr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  required
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">الـ Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">ترتيب العرض</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={e => setSortOrder(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
