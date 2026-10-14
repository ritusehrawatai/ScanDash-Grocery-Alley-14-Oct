import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  KeyRound,
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Search,
  Sliders,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react';
import { User, UserRole, CreateUserData } from '../../types/auth';
import { fetchAllUsers, createUser, updateUserRole, updateUserStatus, deleteUser, updateProductThreshold } from '../../api/userApi';
import { fetchProducts } from '../../api/productApi';
import { Product } from '../../types/product';
import { useAuth } from '../../context/AuthContext';

export const UserManagement: React.FC = () => {
  const { user: currentUser, isOwnerOrAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Create User Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<CreateUserData>({
    username: '',
    password: '',
    fullName: '',
    email: '',
    role: 'ROLE_CASHIER',
  });
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);

  // Threshold update state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newThreshold, setNewThreshold] = useState<number>(10);
  const [thresholdSubmitting, setThresholdSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, prodList] = await Promise.all([
        fetchAllUsers(),
        fetchProducts(),
      ]);
      setUsers(userList);
      setProducts(prodList);
    } catch (err: any) {
      setError(err.message || 'Failed to load user management data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.password.trim() || !createForm.fullName.trim()) {
      return;
    }

    setCreateSubmitting(true);
    setError(null);
    try {
      const created = await createUser({
        ...createForm,
        username: createForm.username.trim(),
        fullName: createForm.fullName.trim(),
        email: createForm.email?.trim() || `${createForm.username.trim()}@freshcartpos.com`,
      });
      setUsers((prev) => [...prev, created]);
      setSuccessMsg(`User '${created.username}' created successfully with role ${created.role.replace('ROLE_', '')}`);
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        password: '',
        fullName: '',
        email: '',
        role: 'ROLE_CASHIER',
      });
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setSuccessMsg(`Role updated to ${newRole.replace('ROLE_', '')} for user #${userId}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user role');
    }
  };

  const handleStatusToggle = async (userId: number, currentStatus: boolean) => {
    try {
      const updated = await updateUserStatus(userId, !currentStatus);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setSuccessMsg(`User #${userId} status set to ${!currentStatus ? 'Active' : 'Disabled'}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user account '${username}'?`)) {
      return;
    }
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccessMsg(`User '${username}' deleted successfully`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const handleSaveThreshold = async () => {
    if (!selectedProduct) return;
    setThresholdSubmitting(true);
    try {
      await updateProductThreshold(selectedProduct.id, newThreshold);
      setProducts((prev) =>
        prev.map((p) => (p.id === selectedProduct.id ? { ...p, minimumInventoryThreshold: newThreshold } : p))
      );
      setSuccessMsg(`Updated reorder threshold for '${selectedProduct.name}' to ${newThreshold} units`);
      setSelectedProduct(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update inventory threshold');
    } finally {
      setThresholdSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">Role-Based Access Control & Users</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Backend RBAC Enforcement: OWNER, ADMIN, and CASHIER privileges with salted password hashing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* RBAC Role Matrix Card */}
      <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 border border-stone-800 shadow-md">
        <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider">
              RBAC Role Permission Matrix
            </h2>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
            Enforced on Backend REST APIs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* OWNER Role */}
          <div className="bg-stone-800/80 rounded-xl p-4 border border-stone-700/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-emerald-300 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  OWNER
                </span>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Full Authority
                </span>
              </div>
              <p className="text-stone-300 text-[11px] mb-3">
                Store proprietor with comprehensive privileges across operations and financial governance.
              </p>
              <div className="space-y-1.5 text-stone-200 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Products (Full CRUD & Catalog)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Inventory (Adjustments & Purchases)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Invoices (OCR Upload & Review)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Reports (Sales, Revenue, CSV)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Notifications (Stock Alerts)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>User Management (Roles & Status)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Inventory Thresholds (Low-Stock Limits)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>POS, Checkout & Sales Receipts</span>
                </div>
              </div>
            </div>
          </div>

          {/* ADMIN Role */}
          <div className="bg-stone-800/80 rounded-xl p-4 border border-stone-700/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-purple-300 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  ADMIN
                </span>
                <span className="text-[10px] bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded font-mono">
                  Store Administration
                </span>
              </div>
              <p className="text-stone-300 text-[11px] mb-3">
                System administrators managing inventory, catalog, purchase invoices, and store personnel.
              </p>
              <div className="space-y-1.5 text-stone-200 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Products (Full CRUD & Catalog)</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Inventory (Adjustments & Purchases)</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Invoices (OCR Upload & Review)</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Reports (Sales, Revenue, CSV)</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Notifications (Stock Alerts)</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>User Management (Roles & Status)</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Inventory Thresholds (Low-Stock Limits)</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>POS, Checkout & Sales Receipts</span>
                </div>
              </div>
            </div>
          </div>

          {/* CASHIER Role */}
          <div className="bg-stone-800/80 rounded-xl p-4 border border-stone-700/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  CASHIER
                </span>
                <span className="text-[10px] bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded font-mono">
                  Front-Line Lane
                </span>
              </div>
              <p className="text-stone-300 text-[11px] mb-3">
                Front-line cashier dedicated to product search, voice lookup, cart management, checkout, and receipts.
              </p>
              <div className="space-y-1.5 text-stone-200 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Product Search (Name, SKU, Barcode)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Voice Search (Voice Queries)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>POS Terminal (Cart Operations)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Checkout (Transactional Sale)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Receipt (View & Print)</span>
                </div>

                <div className="pt-2 border-t border-stone-700/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Products CRUD (403 Forbidden)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Inventory & Purchases (403 Forbidden)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Invoices & OCR (403 Forbidden)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Reports & CSV Export (403 Forbidden)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>User Management (403 Forbidden)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users List Section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">System Users & Accounts</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Passwords securely hashed with PBKDF2/BCrypt. Never stored in plain text.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-stone-400 text-xs">
            No users found matching query '{searchTerm}'.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 text-stone-500 font-semibold uppercase tracking-wider text-[10px] border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredUsers.map((u) => {
                  const roleUpper = u.role.toUpperCase();
                  const isOwner = roleUpper === 'ROLE_OWNER' || roleUpper === 'OWNER';
                  const isAdmin = roleUpper === 'ROLE_ADMIN' || roleUpper === 'ADMIN';
                  const isCashier = roleUpper === 'ROLE_CASHIER' || roleUpper === 'CASHIER';

                  return (
                    <tr key={u.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isOwner
                                ? 'bg-emerald-100 text-emerald-800'
                                : isAdmin
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-stone-900">{u.fullName || u.username}</div>
                            <div className="text-[11px] text-stone-400 font-mono">@{u.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-stone-600">
                        {u.email || `${u.username}@freshcartpos.com`}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono border ${
                              isOwner
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : isAdmin
                                ? 'bg-purple-50 text-purple-800 border-purple-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            {u.role.replace('ROLE_', '')}
                          </span>

                          {/* Quick Role Switch dropdown */}
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="text-[10px] bg-white border border-stone-200 rounded px-1.5 py-0.5 text-stone-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          >
                            <option value="ROLE_OWNER">Change to OWNER</option>
                            <option value="ROLE_ADMIN">Change to ADMIN</option>
                            <option value="ROLE_CASHIER">Change to CASHIER</option>
                          </select>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleStatusToggle(u.id, u.enabled)}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition ${
                            u.enabled
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                          }`}
                          title="Click to toggle status"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${u.enabled ? 'bg-emerald-500' : 'bg-stone-400'}`}
                          />
                          <span>{u.enabled ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {currentUser?.id !== u.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="text-stone-400 hover:text-rose-600 text-[11px] font-medium px-2 py-1 rounded hover:bg-rose-50 transition cursor-pointer"
                              title="Delete user account"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inventory Thresholds Management Card (OWNER/ADMIN capability) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                Inventory Thresholds Configuration
              </h2>
              <p className="text-xs text-stone-500">
                OWNER & ADMIN privilege: Configure low-stock alert thresholds and minimum reorder triggers.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold">
            OWNER/ADMIN ONLY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.slice(0, 6).map((prod) => (
            <div
              key={prod.id}
              className="p-3 rounded-xl border border-stone-200 hover:border-emerald-300 bg-stone-50/50 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-xs text-stone-900 truncate max-w-[170px]">{prod.name}</p>
                <p className="text-[10px] text-stone-400 font-mono">SKU: {prod.sku}</p>
                <div className="text-[11px] text-stone-600 mt-1">
                  Threshold: <span className="font-bold text-emerald-700">{prod.minimumInventoryThreshold}</span> units
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedProduct(prod);
                  setNewThreshold(prod.minimumInventoryThreshold);
                }}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
              >
                Set Limit
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Threshold Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-200 animate-scaleUp">
            <h3 className="text-sm font-bold text-stone-900 mb-1">Set Inventory Reorder Threshold</h3>
            <p className="text-xs text-stone-500 mb-4">{selectedProduct.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Minimum Stock Threshold (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  When stock falls at or below this value, an in-app low-stock notification triggers.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={thresholdSubmitting}
                  onClick={handleSaveThreshold}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {thresholdSubmitting ? 'Saving...' : 'Save Threshold'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-scaleUp">
            <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-stone-900">Create New System User</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="e.g. cashier2"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="e.g. Jordan Miller"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="e.g. jmiller@freshcartpos.com"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Set initial password"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Salted & hashed with PBKDF2/BCrypt before storage.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Assign Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ROLE_OWNER">OWNER - Full ownership, store & financial control</option>
                  <option value="ROLE_ADMIN">ADMIN - Store administrator & inventory manager</option>
                  <option value="ROLE_CASHIER">CASHIER - Front-line POS, search, checkout & receipts</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
