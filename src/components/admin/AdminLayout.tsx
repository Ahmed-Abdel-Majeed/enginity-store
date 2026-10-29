import React from 'react';
import {
  Package,
  FolderTree,
  Settings,
  LogOut,
  ExternalLink,
  Wrench,
  Lightbulb
} from 'lucide-react';

export type AdminTabType =
  | 'products'
  | 'categories'
  | 'custom-requests'
  | 'product-suggestions'
  | 'settings'
  | 'new-product'
  | 'edit-product';

interface AdminLayoutProps {
  currentTab: AdminTabType;
  onSelectTab: (
    tab:
      | 'products'
      | 'categories'
      | 'custom-requests'
      | 'product-suggestions'
      | 'settings'
  ) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  onLogout,
  children
}) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-cairo">
      
      {/* Top Admin Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-mono font-bold text-xs">
              ●—●
            </div>
            <span className="font-heading font-extrabold text-lg tracking-tight text-white">
              ENGINITY ADMIN
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-400 font-mono text-[10px] font-semibold border border-blue-800">
              Private Workspace
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/ar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>المتجر العام</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs font-semibold border border-red-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
        
        {/* Sidebar Nav - Horizontal Swipeable Bar on Mobile, Vertical Stack on Desktop */}
        <aside className="md:col-span-3 flex md:flex-col overflow-x-auto no-scrollbar gap-2 pb-1 md:pb-0">
          <button
            onClick={() => onSelectTab('products')}
            className={`shrink-0 md:w-full px-4 py-3 min-h-[44px] rounded-xl font-semibold text-xs flex items-center gap-2.5 transition-colors text-start cursor-pointer whitespace-nowrap ${
              currentTab === 'products' || currentTab === 'new-product' || currentTab === 'edit-product'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>المنتجات (Products)</span>
          </button>

          <button
            onClick={() => onSelectTab('custom-requests')}
            className={`shrink-0 md:w-full px-4 py-3 min-h-[44px] rounded-xl font-semibold text-xs flex items-center gap-2.5 transition-colors text-start cursor-pointer whitespace-nowrap ${
              currentTab === 'custom-requests'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>الطلبات المخصصة (Custom)</span>
          </button>

          <button
            onClick={() => onSelectTab('product-suggestions')}
            className={`shrink-0 md:w-full px-4 py-3 min-h-[44px] rounded-xl font-semibold text-xs flex items-center gap-2.5 transition-colors text-start cursor-pointer whitespace-nowrap ${
              currentTab === 'product-suggestions'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>المقترحات وتحليل الطلب</span>
          </button>

          <button
            onClick={() => onSelectTab('categories')}
            className={`shrink-0 md:w-full px-4 py-3 min-h-[44px] rounded-xl font-semibold text-xs flex items-center gap-2.5 transition-colors text-start cursor-pointer whitespace-nowrap ${
              currentTab === 'categories'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>التصنيفات (Categories)</span>
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            className={`shrink-0 md:w-full px-4 py-3 min-h-[44px] rounded-xl font-semibold text-xs flex items-center gap-2.5 transition-colors text-start cursor-pointer whitespace-nowrap ${
              currentTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>الإعدادات العامة (Settings)</span>
          </button>
        </aside>

        {/* Content Body */}
        <main className="md:col-span-9 bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 md:p-8">
          {children}
        </main>

      </div>

    </div>
  );
};
