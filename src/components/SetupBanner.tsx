import React from 'react';
import { Database, AlertTriangle, Key, Terminal, ExternalLink } from 'lucide-react';

export const SetupBanner: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-start">
        
        {/* Header Icon */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-white">
              Enginity Store — Supabase Setup Required
            </h1>
            <p className="text-xs text-slate-400">
              إعداد ربط قاعدة البيانات Supabase مطلوبة لتشغيل المتجر بدون بيانات وهمية
            </p>
          </div>
        </div>

        {/* Warning Alert */}
        <div className="p-4 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-200 text-xs leading-relaxed flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Missing Required Environment Variables</div>
            <p>
              Please set the required Supabase credentials in your <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">.env</code> file. No fallback mock data is used.
            </p>
          </div>
        </div>

        {/* Missing Variables List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Required Environment Variables Checklist
          </h2>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white">SUPABASE_URL</span>
              </div>
              <span className="text-red-400 text-[11px]">MISSING</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white">SUPABASE_ANON_KEY</span>
              </div>
              <span className="text-red-400 text-[11px]">MISSING</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-300">SITE_URL</span>
              </div>
              <span className="text-slate-500 text-[11px]">OPTIONAL / DEFAULT</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-300">XPAY_ALLOWED_HOSTS</span>
              </div>
              <span className="text-slate-500 text-[11px]">OPTIONAL</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Setup Instructions</span>
          </h2>

          <ol className="list-decimal list-inside text-xs text-slate-300 space-y-2 leading-relaxed">
            <li>Create a new Supabase project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-1">supabase.com <ExternalLink className="w-3 h-3" /></a>.</li>
            <li>Run the SQL script from <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300 font-mono">supabase/migrations/0001_init.sql</code> in the Supabase SQL Editor.</li>
            <li>Create an admin user under Auth and register their UUID into the <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300 font-mono">admins</code> table.</li>
            <li>Populate <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300 font-mono">.env</code> with your project URL and ANON key, then restart the server.</li>
          </ol>
        </div>

      </div>
    </div>
  );
};
