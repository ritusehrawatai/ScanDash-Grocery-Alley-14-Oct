import React, { useState } from 'react';
import {
  Server,
  Database,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { HealthStatus } from '../types/health';

interface HealthDashboardProps {
  data: HealthStatus | null;
  loading: boolean;
  latencyMs: number;
  rawJson: string;
  error?: string;
  onRefresh: () => void;
  lastChecked: Date | null;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({
  data,
  loading,
  latencyMs,
  rawJson,
  error,
  onRefresh,
  lastChecked,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Trigger */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider">
              <span>ScanDash-Grocery Alley Core</span>
              <span aria-hidden="true">·</span>
              <span>Health Check Probe</span>
            </div>
            <h1 className="text-xl font-bold text-stone-900 mt-1">
              Architecture Initialization Status
            </h1>
            <p className="text-sm text-stone-600 mt-0.5">
              Backend REST API endpoint <code className="font-mono text-xs bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded">GET /api/v1/health</code> communicating with Spring Boot & PostgreSQL architecture.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-4 py-2 rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Querying API...' : 'Run Health Check'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Backend Connection Alert:</span> {error}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Backend Status */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Backend Service</span>
            <Server className="w-4 h-4 text-stone-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">
              {data?.status || (loading ? 'Checking...' : 'OFFLINE')}
            </span>
            <span className="text-xs text-emerald-700 font-medium">
              {data?.status === 'UP' ? 'Operational' : ''}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
            <div className="flex justify-between">
              <span>Service:</span>
              <span className="font-mono text-stone-700">{data?.service || 'grocery-pos-backend'}</span>
            </div>
            <div className="flex justify-between">
              <span>Version:</span>
              <span className="font-mono text-stone-700">{data?.version || '1.0.0-SNAPSHOT'}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Database Connection */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">PostgreSQL Database</span>
            <Database className="w-4 h-4 text-stone-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">
              {data?.database?.status || 'CONFIGURED'}
            </span>
            <span className="text-xs text-emerald-700 font-medium">PostgreSQL 15</span>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
            <div className="flex justify-between truncate">
              <span>URL:</span>
              <span className="font-mono text-stone-700 truncate max-w-[140px]" title={data?.database?.url}>
                {data?.database?.url || 'jdbc:postgresql://localhost:5432/grocerypos'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dialect:</span>
              <span className="font-mono text-stone-700">PostgreSQLDialect</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Round-Trip Latency */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">REST Latency</span>
            <Zap className="w-4 h-4 text-stone-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900 font-mono">
              {latencyMs}
            </span>
            <span className="text-xs text-stone-500">ms</span>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
            <div className="flex justify-between">
              <span>Protocol:</span>
              <span className="font-mono text-stone-700">HTTP/1.1 REST</span>
            </div>
            <div className="flex justify-between">
              <span>Payload:</span>
              <span className="font-mono text-stone-700">application/json</span>
            </div>
          </div>
        </div>

        {/* Metric 4: System Memory / Uptime */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Uptime & Memory</span>
            <Clock className="w-4 h-4 text-stone-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900 font-mono">
              {data ? formatUptime(data.uptimeSeconds) : '0s'}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
            <div className="flex justify-between">
              <span>Memory Heap:</span>
              <span className="font-mono text-stone-700">
                {data?.memory?.totalMemoryMb ? `${data.memory.totalMemoryMb} MB` : 'Dynamic'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Profile:</span>
              <span className="font-mono text-stone-700 uppercase">{data?.environment || 'dev'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modules Roadmap & Architecture Readiness */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">Module Readiness & Scope Verification</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Tracking Phase 1 Architecture Initialization against the project requirements.
            </p>
          </div>
          <span className="text-xs font-mono text-stone-600 bg-stone-100 px-2 py-1 rounded">
            Clean Architecture Separation
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="pb-2.5 font-medium">Module Component</th>
                <th className="pb-2.5 font-medium">Layer & Technology</th>
                <th className="pb-2.5 font-medium">Target Phase</th>
                <th className="pb-2.5 font-medium text-right">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="py-3 font-medium text-stone-900">Project Skeleton & Build System</td>
                <td className="py-3 text-stone-600 font-mono">Maven 3.9 + Spring Boot 3.3.4 + React 19</td>
                <td className="py-3 text-stone-500">Phase 1 (Current)</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Initialized
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">Database Connection & Config</td>
                <td className="py-3 text-stone-600 font-mono">PostgreSQL 15 / Spring Data JPA</td>
                <td className="py-3 text-stone-500">Phase 1 (Current)</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">Health Check REST API</td>
                <td className="py-3 text-stone-600 font-mono">GET /api/v1/health & /ping (DTOs)</td>
                <td className="py-3 text-stone-500">Phase 1 (Current)</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">Frontend-to-Backend Layer</td>
                <td className="py-3 text-stone-600 font-mono">React TS fetch client + CORS + Proxy</td>
                <td className="py-3 text-stone-500">Phase 1 (Current)</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">Product Database & Entities</td>
                <td className="py-3 text-stone-600 font-mono">Product, Category, Supplier (JPA + Constraints)</td>
                <td className="py-3 text-stone-500">Database Layer</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Implemented
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">Product Management APIs & Screens</td>
                <td className="py-3 text-stone-600 font-mono">REST Controllers + POS Screens + Search</td>
                <td className="py-3 text-stone-500">Phase 2</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Implemented
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">Inventory Foundation</td>
                <td className="py-3 text-stone-600 font-mono">Inventory & InventoryTransaction JPA + Service</td>
                <td className="py-3 text-stone-500">Phase 2</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Implemented
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">Invoice Scanning & Extraction</td>
                <td className="py-3 text-stone-600 font-mono">Tesseract OCR (Open Source)</td>
                <td className="py-3 text-stone-500">Phase 3</td>
                <td className="py-3 text-right text-stone-500">Ready for Implementation</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">POS Checkout Terminal & Sales</td>
                <td className="py-3 text-stone-600 font-mono">Spring REST + React UI</td>
                <td className="py-3 text-stone-500">Phase 4</td>
                <td className="py-3 text-right text-stone-500">Ready for Implementation</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-stone-900">User Authentication & RBAC</td>
                <td className="py-3 text-stone-600 font-mono">Spring Security + JWT / Sessions</td>
                <td className="py-3 text-stone-500">Phase 6</td>
                <td className="py-3 text-right text-stone-500">Ready for Implementation</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live API Response Inspector */}
      <div className="bg-stone-900 rounded-lg p-4 text-stone-200">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-mono font-medium text-stone-300">
              Live Payload Response: GET /api/v1/health
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-400">
              Last probe: {lastChecked ? lastChecked.toLocaleTimeString() : 'N/A'}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-300 rounded transition-colors cursor-pointer"
              title="Copy JSON Payload"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
        </div>

        <pre className="font-mono text-xs text-emerald-400/90 overflow-x-auto p-3 bg-stone-950/60 rounded border border-stone-800 max-h-72">
          {rawJson}
        </pre>
      </div>
    </div>
  );
};
