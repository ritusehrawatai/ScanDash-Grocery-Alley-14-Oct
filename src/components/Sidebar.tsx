import React from 'react';
import {
  Activity,
  Layers,
  Terminal,
  ShoppingBag,
  Package,
  Boxes,
  FileScan,
  UploadCloud,
  BarChart3,
  BookOpen,
  Store,
  LayoutDashboard,
  Users,
  Lock,
  Shield,
  ShieldAlert,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab = 'dashboard' | 'reports' | 'pos' | 'products' | 'categories' | 'inventory' | 'invoices' | 'users' | 'audit' | 'health' | 'architecture' | 'explorer' | 'setup';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user, isOwner, isAdmin, isCashier, isOwnerOrAdmin } = useAuth();
  const roleName = user?.role ? user.role.replace('ROLE_', '') : 'GUEST';

  return (
    <aside className="w-64 bg-stone-900 text-stone-200 flex flex-col justify-between shrink-0 select-none">
      <div className="overflow-y-auto">
        <div className="p-4 border-b border-stone-800">
          <div className="flex items-center gap-2 text-stone-100 font-bold text-sm tracking-tight">
            <Store className="w-4 h-4 text-emerald-500" />
            <span>ScanDash POS</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-stone-400 font-mono">Current Session:</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                isOwner
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : isAdmin
                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {roleName}
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center justify-between">
            <span>Store Operations</span>
            {isCashier && <span className="text-[9px] font-mono text-amber-400">Cashier Mode</span>}
          </div>

          {/* POS Terminal / Cart (Primary for Cashier and accessible to all) */}
          <button
            onClick={() => onTabChange('pos')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'pos'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">POS Terminal (Lane 01)</span>
            </div>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
              POS
            </span>
          </button>

          {/* Owner Dashboard */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isCashier
                ? 'text-stone-400 hover:bg-stone-800/60'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4" />
              <span>Owner Dashboard</span>
            </div>
            {isOwnerOrAdmin ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ) : (
              <span title="Restricted to Owner/Admin">
                <Lock className="w-3 h-3 text-stone-500" />
              </span>
            )}
          </button>

          {/* Reports & Analytics */}
          <button
            onClick={() => onTabChange('reports')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isCashier
                ? 'text-stone-400 hover:bg-stone-800/60'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4" />
              <span>Reports & CSV Export</span>
            </div>
            {isOwnerOrAdmin ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ) : (
              <span title="Restricted to Owner/Admin">
                <Lock className="w-3 h-3 text-stone-500" />
              </span>
            )}
          </button>

          {/* Product Management */}
          <button
            onClick={() => onTabChange('products')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'products'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isCashier
                ? 'text-stone-400 hover:bg-stone-800/60'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4" />
              <span>Products & Catalog</span>
            </div>
            {isOwnerOrAdmin ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ) : (
              <span title="Restricted to Owner/Admin">
                <Lock className="w-3 h-3 text-stone-500" />
              </span>
            )}
          </button>

          {/* Inventory Management */}
          <button
            onClick={() => onTabChange('inventory')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isCashier
                ? 'text-stone-400 hover:bg-stone-800/60'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Boxes className="w-4 h-4" />
              <span>Inventory & Thresholds</span>
            </div>
            {isOwnerOrAdmin ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ) : (
              <span title="Restricted to Owner/Admin">
                <Lock className="w-3 h-3 text-stone-500" />
              </span>
            )}
          </button>

          {/* Purchase Invoices (Admin / Owner) */}
          <button
            onClick={() => onTabChange('invoices')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'invoices'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isCashier
                ? 'text-stone-400 hover:bg-stone-800/60'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <UploadCloud className="w-4 h-4" />
              <span>Invoices & OCR</span>
            </div>
            {isOwnerOrAdmin ? (
              <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                OCR
              </span>
            ) : (
              <span title="Restricted to Owner/Admin">
                <Lock className="w-3 h-3 text-stone-500" />
              </span>
            )}
          </button>

          {/* User & Role Management (Admin / Owner) */}
          <button
            onClick={() => onTabChange('users')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'users'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isCashier
                ? 'text-stone-400 hover:bg-stone-800/60'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>User & Role (RBAC)</span>
            </div>
            {isOwnerOrAdmin ? (
              <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                RBAC
              </span>
            ) : (
              <span title="Restricted to Owner/Admin">
                <Lock className="w-3 h-3 text-stone-500" />
              </span>
            )}
          </button>

          {/* Audit Logs & Trail (Admin / Owner) */}
          <button
            onClick={() => onTabChange('audit')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isCashier
                ? 'text-stone-400 hover:bg-stone-800/60'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <History className="w-4 h-4" />
              <span>Audit Trail & Logs</span>
            </div>
            {isOwnerOrAdmin ? (
              <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                AUDIT
              </span>
            ) : (
              <span title="Restricted to Owner/Admin">
                <Lock className="w-3 h-3 text-stone-500" />
              </span>
            )}
          </button>
        </div>

        {/* System & Architecture Section */}
        <div className="p-3 pt-1 space-y-1 border-t border-stone-800/60">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            Diagnostics & APIs
          </div>

          <button
            onClick={() => onTabChange('explorer')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'explorer'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4" />
              <span>REST API Explorer</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>

          <button
            onClick={() => onTabChange('health')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'health'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4" />
              <span>Health & Live Metrics</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>

          <button
            onClick={() => onTabChange('architecture')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4" />
              <span>Architecture Pipeline</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>

          <button
            onClick={() => onTabChange('setup')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
              activeTab === 'setup'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4" />
              <span>Local Dev & Setup Guide</span>
            </div>
            <span className="text-[10px] text-stone-400">Docs</span>
          </button>
        </div>
      </div>

      {/* Footer System Specs */}
      <div className="p-4 border-t border-stone-800 text-[11px] text-stone-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Active Role</span>
          <span className="font-mono text-emerald-400 font-bold">{roleName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>RBAC Enforcement</span>
          <span className="font-mono text-stone-300">Backend + Frontend</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Security Engine</span>
          <span className="font-mono text-stone-300">Spring Security 6</span>
        </div>
      </div>
    </aside>
  );
};
