import React from 'react';
import { ShieldAlert, Lock, ArrowRight, CheckCircle2, UserCheck, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from '../Sidebar';

interface RbacRestrictedViewProps {
  tabName: string;
  onNavigate: (tab: NavTab) => void;
}

export const RbacRestrictedView: React.FC<RbacRestrictedViewProps> = ({ tabName, onNavigate }) => {
  const { user, isCashier, quickSwitchUser } = useAuth();
  const roleName = user?.role ? user.role.replace('ROLE_', '') : 'UNKNOWN';

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center">
      <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200 uppercase tracking-wider">
            HTTP 403 Forbidden - RBAC Policy
          </span>
          <h2 className="text-2xl font-bold text-stone-900 mt-3">Access Denied: Role Restricted</h2>
          <p className="text-stone-500 text-sm mt-1 max-w-lg mx-auto">
            The requested module <span className="font-semibold text-stone-800">'{tabName}'</span> requires{' '}
            <span className="font-semibold text-emerald-700">OWNER</span> or{' '}
            <span className="font-semibold text-purple-700">ADMIN</span> role privileges.
          </p>
        </div>

        <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 text-left space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <span className="text-stone-500">Your Active User:</span>
            <span className="font-semibold text-stone-900">@{user?.username} ({user?.fullName})</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <span className="text-stone-500">Your Active Role:</span>
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              {roleName}
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="font-semibold text-stone-700 block">Permitted CASHIER Capabilities:</span>
            <div className="grid grid-cols-2 gap-2 text-stone-600">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Product Search (Barcode & SKU)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Voice Product Search</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>POS Terminal (Cart operations)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Transactional Checkout</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Sales Receipt Generation</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('pos')}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Go to POS Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {isCashier && (
            <button
              onClick={() => quickSwitchUser('owner')}
              className="w-full sm:w-auto px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-stone-300"
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Switch to Owner Role</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
