import React from 'react';
import { Category, Lang } from '../types';
import { Translations } from '../i18n/ar';
import { Search, X } from 'lucide-react';

interface SearchAndFilterProps {
  categories: Category[];
  selectedCategory: number | null;
  searchQuery: string;
  lang: Lang;
  t: Translations;
  onSelectCategory: (categoryId: number | null) => void;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  totalResultsCount?: number;
}

const SearchAndFilterComponent: React.FC<SearchAndFilterProps> = ({
  categories,
  selectedCategory,
  searchQuery,
  lang,
  t,
  onSelectCategory,
  onSearchChange,
  onClearSearch,
  totalResultsCount
}) => {
  const isRtl = lang === 'ar';

  return (
    <div className="space-y-6 font-cairo">
      
      {/* Search Input Bar */}
      <div className="relative max-w-2xl mx-auto">
        <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-slate-400">
          <Search className="w-5 h-5 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full ps-11 pe-10 py-3.5 bg-white rounded-2xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#2F6BFF]/30 focus:border-[#2F6BFF] shadow-xs hover:border-slate-300 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={onClearSearch}
            className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
            title={t.clearSearch}
          >
            <div className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200">
              <X className="w-3.5 h-3.5" />
            </div>
          </button>
        )}
      </div>

      {/* Segmented Category Filter Control */}
      <div className="relative max-w-5xl mx-auto">
        
        {/* Scrollable Container on Mobile, Wrap Container on Desktop */}
        <div className="flex items-center justify-start md:justify-center overflow-x-auto md:overflow-visible no-scrollbar flex-nowrap md:flex-wrap gap-2 p-2 bg-slate-100/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs scroll-smooth">
          
          {/* All Categories Pill */}
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className={`shrink-0 px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
              selectedCategory === null
                ? 'bg-gradient-to-r from-[#0B1F3A] to-[#2F6BFF] text-white shadow-md shadow-blue-500/20'
                : 'bg-white/90 hover:bg-white text-slate-700 hover:text-[#2F6BFF] border border-slate-200/80 shadow-2xs'
            }`}
          >
            <span>{t.allCategories}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                selectedCategory === null
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {categories.length}
            </span>
          </button>

          {/* Individual Category Pills */}
          {categories.map(cat => {
            const categoryName = isRtl ? cat.name_ar : cat.name_en;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`shrink-0 px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center whitespace-nowrap active:scale-95 ${
                  isSelected
                    ? 'bg-[#2F6BFF] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                    : 'bg-white/90 hover:bg-white text-slate-700 hover:text-[#2F6BFF] border border-slate-200/80 shadow-2xs'
                }`}
              >
                {categoryName}
              </button>
            );
          })}

        </div>

      </div>

      {/* Result Counter (if total count provided) */}
      {typeof totalResultsCount === 'number' && (
        <div className="text-xs text-slate-500 font-medium text-center">
          {isRtl ? `عرض ${totalResultsCount} منتجات أتمتة جاهزة` : `Showing ${totalResultsCount} ready automation workflows`}
        </div>
      )}

    </div>
  );
};

export const SearchAndFilter = React.memo(SearchAndFilterComponent);
