/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { OwnerDashboard } from './components/Dashboard/OwnerDashboard';
import { ReportsView } from './components/Reports/ReportsView';
import { PosTerminal } from './components/PosTerminal/PosTerminal';
import { ProductList } from './components/ProductManagement/ProductList';
import { InventoryList } from './components/InventoryManagement/InventoryList';
import { InvoiceUploadView } from './components/InvoiceManagement/InvoiceUploadView';
import { HealthDashboard } from './components/HealthDashboard';
import { ArchitectureView } from './components/ArchitectureView';
import { ApiExplorer } from './components/ApiExplorer';
import { DevSetupGuide } from './components/DevSetupGuide';
import { UserManagement } from './components/UserManagement/UserManagement';
import { AuditLogViewer } from './components/AuditLog/AuditLogViewer';
import { RbacRestrictedView } from './components/Auth/RbacRestrictedView';
import { fetchHealthStatus, HealthCheckResult } from './api/healthApi';
import { HealthStatus } from './types/health';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/Auth/LoginScreen';

function PosShell() {
  const { isAuthenticated, isLoading: authLoading, isCashier, isOwnerOrAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [rawJson, setRawJson] = useState<string>('{}');
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // If user is a Cashier, auto-route to POS Terminal on initial load or login
  useEffect(() => {
    if (isCashier && (activeTab === 'dashboard' || activeTab === 'users' || activeTab === 'reports' || activeTab === 'invoices' || activeTab === 'audit' || activeTab === 'categories')) {
      setActiveTab('pos');
    }
  }, [isCashier, user?.id]);

  const performHealthCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res: HealthCheckResult = await fetchHealthStatus();
      setLatencyMs(res.latencyMs);
      setRawJson(res.rawJson);
      setError(res.error);
      if (res.data) {
        setHealthData(res.data);
      }
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    performHealthCheck();
    // Auto-poll health status every 30 seconds
    const interval = setInterval(performHealthCheck, 30000);
    return () => clearInterval(interval);
  }, [performHealthCheck]);

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-stone-100 text-stone-600 gap-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Validating security credentials...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const isHealthy = !error && healthData?.status === 'UP';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-100 font-sans text-stone-900 antialiased">
      {/* POS Navigation Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        {/* Header Bar */}
        <Header
          onRefresh={performHealthCheck}
          isRefreshing={loading}
          isHealthy={isHealthy}
          latencyMs={latencyMs}
          lastChecked={lastChecked}
        />

        {/* Dynamic Views */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Cashier allowed: POS Terminal */}
            {activeTab === 'pos' && <PosTerminal />}

            {/* OWNER & ADMIN only views (CASHIER gets RbacRestrictedView) */}
            {activeTab === 'dashboard' && (
              isCashier ? (
                <RbacRestrictedView tabName="Owner Dashboard" onNavigate={setActiveTab} />
              ) : (
                <OwnerDashboard onNavigate={setActiveTab} />
              )
            )}

            {activeTab === 'reports' && (
              isCashier ? (
                <RbacRestrictedView tabName="Reports & Analytics" onNavigate={setActiveTab} />
              ) : (
                <ReportsView onNavigate={setActiveTab} />
              )
            )}

            {activeTab === 'products' && (
              isCashier ? (
                <RbacRestrictedView tabName="Products & Catalog Management" onNavigate={setActiveTab} />
              ) : (
                <ProductList initialTab="products" />
              )
            )}

            {activeTab === 'categories' && (
              isCashier ? (
                <RbacRestrictedView tabName="Products & Catalog Management" onNavigate={setActiveTab} />
              ) : (
                <ProductList initialTab="categories" />
              )
            )}

            {activeTab === 'inventory' && (
              isCashier ? (
                <RbacRestrictedView tabName="Inventory Management & Adjustments" onNavigate={setActiveTab} />
              ) : (
                <InventoryList />
              )
            )}

            {activeTab === 'invoices' && (
              isCashier ? (
                <RbacRestrictedView tabName="Purchase Invoices & OCR" onNavigate={setActiveTab} />
              ) : (
                <InvoiceUploadView />
              )
            )}

            {activeTab === 'users' && (
              isCashier ? (
                <RbacRestrictedView tabName="User & Role Management (RBAC)" onNavigate={setActiveTab} />
              ) : (
                <UserManagement />
              )
            )}

            {activeTab === 'audit' && (
              isCashier ? (
                <RbacRestrictedView tabName="Audit Trail & Logs" onNavigate={setActiveTab} />
              ) : (
                <AuditLogViewer />
              )
            )}

            {/* Diagnostics and technical info */}
            {activeTab === 'health' && (
              <HealthDashboard
                data={healthData}
                loading={loading}
                latencyMs={latencyMs}
                rawJson={rawJson}
                error={error}
                onRefresh={performHealthCheck}
                lastChecked={lastChecked}
              />
            )}

            {activeTab === 'architecture' && <ArchitectureView />}

            {activeTab === 'explorer' && <ApiExplorer />}

            {activeTab === 'setup' && <DevSetupGuide />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PosShell />
    </AuthProvider>
  );
}
