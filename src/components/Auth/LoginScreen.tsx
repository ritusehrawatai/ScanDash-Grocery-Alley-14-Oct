import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Store,
  ArrowRight,
  Sparkles,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login, error, clearError, isLoading } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setSubmitting(true);
    await login({ username: username.trim(), password });
    setSubmitting(false);
  };

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    clearError();
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">ScanDash-Grocery Alley</h1>
          <p className="text-stone-500 text-sm mt-1">Enterprise Point of Sale & Inventory Management</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-600" />
              Sign in to your account
            </h2>
            <p className="text-stone-500 text-xs mt-0.5">
              Enter your credentials to access the point of sale system.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Failed</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="Enter username (e.g. admin)"
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-medium text-sm rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition flex items-center justify-center gap-2 group cursor-pointer"
            >
              {submitting || isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </>
              )}
            </button>
          </form>

          {/* Quick Credential Switcher */}
          <div className="mt-8 pt-6 border-t border-stone-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Demo Sign-In
              </span>
              <span className="text-[11px] text-stone-400">Click to fill</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('owner', 'Owner@123')}
                className={`p-2.5 rounded-xl border text-left transition text-xs flex flex-col justify-between ${
                  username === 'owner'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-700'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center justify-between">
                    Owner
                    {username === 'owner' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">Store Owner</div>
                </div>
                <div className="text-[10px] font-mono text-stone-400 mt-1">Owner@123</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'Admin@123')}
                className={`p-2.5 rounded-xl border text-left transition text-xs flex flex-col justify-between ${
                  username === 'admin'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-700'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center justify-between">
                    Admin
                    {username === 'admin' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">System Admin</div>
                </div>
                <div className="text-[10px] font-mono text-stone-400 mt-1">Admin@123</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('cashier', 'Cashier@123')}
                className={`p-2.5 rounded-xl border text-left transition text-xs flex flex-col justify-between ${
                  username === 'cashier'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-700'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center justify-between">
                    Cashier
                    {username === 'cashier' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">Front Cashier</div>
                </div>
                <div className="text-[10px] font-mono text-stone-400 mt-1">Cashier@123</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Architecture Badge */}
        <div className="mt-6 bg-stone-200/60 rounded-xl p-3.5 border border-stone-300/60 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-stone-600 space-y-1">
            <p className="font-semibold text-stone-800">Protected by Spring Security</p>
            <p>
              Passwords are salted and hashed using BCrypt / PBKDF2 (never saved in plain text).
              All backend POS REST APIs require stateless authenticated Bearer token access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
