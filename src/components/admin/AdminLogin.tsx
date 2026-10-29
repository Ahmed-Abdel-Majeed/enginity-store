import React, { useState } from 'react';
import { Lock, Mail, Key } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('بيانات الدخول غير صحيحة أو الحساب غير مصرح له كمسؤول.');
      }
    } catch {
      setError('حدث خطأ أثناء محاولة الاتصال بخادم المصادقة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-cairo">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-white">
            تسجيل دخول الأدمن
          </h1>
          <p className="text-xs text-slate-400">
            لوحة تحكم إدارة المتجر وإصدار الـ Workflows
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl font-medium text-start">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-start">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute inset-y-0 start-3 my-auto" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@enginity.com"
                className="w-full ps-10 pe-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">كلمة المرور</label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute inset-y-0 start-3 my-auto" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full ps-10 pe-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-md disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'جاري التحقق...' : 'دخول اللوحة'}
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center border-t border-slate-800/80 pt-4">
          محمية عبر Supabase Auth + RLS Checks
        </div>

      </div>
    </div>
  );
};
