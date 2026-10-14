import React from 'react';
import {
  Monitor,
  Network,
  Cpu,
  Layers,
  Database,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const tiers = [
    {
      name: '1. Frontend Presentation Layer',
      tech: 'React 19 + TypeScript + Tailwind CSS',
      role: 'Responsive POS Interface & Real-time Terminal',
      files: ['src/App.tsx', 'src/api/healthApi.ts', 'src/components/*'],
      icon: Monitor,
      color: 'border-blue-500 bg-blue-50/30',
      tag: 'UI & State',
    },
    {
      name: '2. REST API & Gateway',
      tech: 'HTTP/1.1 JSON + OpenAPI 3.0 + CORS Filter',
      role: 'Uniform DTO communication layer (ApiResponse<T>)',
      files: ['/api/v1/health', '/api/v1/health/ping', 'CorsConfig.java'],
      icon: Network,
      color: 'border-emerald-500 bg-emerald-50/30',
      tag: 'Contracts & DTOs',
    },
    {
      name: '3. Web Controller Layer',
      tech: 'Spring Web (@RestController)',
      role: 'Request mapping, validation, and HTTP status codes',
      files: ['HealthCheckController.java', 'GlobalExceptionHandler.java'],
      icon: Layers,
      color: 'border-amber-500 bg-amber-50/30',
      tag: 'Controllers',
    },
    {
      name: '4. Business Service Layer',
      tech: 'Spring Service (@Service)',
      role: 'Domain logic, orchestration, and transaction boundary',
      files: ['HealthCheckService.java', 'common/dto/ApiResponse.java'],
      icon: Cpu,
      color: 'border-purple-500 bg-purple-50/30',
      tag: 'Services',
    },
    {
      name: '5. Data Repository Layer',
      tech: 'Spring Data JPA / Hibernate ORM',
      role: 'Database abstractions, queries, connection pooling',
      files: ['HikariCP Pool', 'schema.sql', 'Future JpaRepositories'],
      icon: FileCode2,
      color: 'border-indigo-500 bg-indigo-50/30',
      tag: 'Persistence',
    },
    {
      name: '6. Database Persistence',
      tech: 'PostgreSQL 15 (Relational DB)',
      role: 'ACID storage (H2 in-memory for JUnit test profiles)',
      files: ['application.yml', 'docker-compose.yml (postgres-data)'],
      icon: Database,
      color: 'border-teal-500 bg-teal-50/30',
      tag: 'Storage',
    },
    {
      name: '7. Security & Authorization Layer',
      tech: 'Spring Security 6.x + BCrypt Hashing + JWT Bearer Tokens',
      role: 'Authentication, password salted hashing (never plain text), and API protection',
      files: ['SecurityConfig.java', 'JwtAuthenticationFilter.java', 'AuthService.java', 'User.java'],
      icon: ShieldCheck,
      color: 'border-purple-500 bg-purple-50/30',
      tag: 'Spring Security',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <h1 className="text-xl font-bold text-stone-900">
          Architecture & System Blueprint
        </h1>
        <p className="text-sm text-stone-600 mt-1 max-w-3xl">
          Clean, decoupled, multi-tiered enterprise architecture built specifically for high-throughput grocery retail checkout and inventory accuracy.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
            <span className="font-semibold text-stone-900 block">Separation of Concerns</span>
            <span className="text-stone-500 mt-0.5 block">Controllers strictly mediate HTTP; business rules reside in Services; database operations in JPA Repositories.</span>
          </div>
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
            <span className="font-semibold text-stone-900 block">Strict DTO Boundary</span>
            <span className="text-stone-500 mt-0.5 block">Entities are never exposed directly to the REST API. All payloads flow via typed DTOs and ApiResponse&lt;T&gt;.</span>
          </div>
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
            <span className="font-semibold text-stone-900 block">Zero-Cost Tooling</span>
            <span className="text-stone-500 mt-0.5 block">Powered entirely by 100% free and open-source tools (Java 17, Spring Boot, PostgreSQL, Tesseract OCR, Docker).</span>
          </div>
        </div>
      </div>

      {/* Tier-by-Tier Pipeline Diagram */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <h2 className="text-base font-bold text-stone-900 mb-4">
          Data Flow Pipeline: Frontend to Database
        </h2>

        <div className="space-y-3">
          {tiers.map((tier, idx) => {
            const Icon = tier.icon;
            return (
              <div key={idx} className="relative">
                <div className={`p-4 border-l-4 rounded-r-lg border bg-white ${tier.color} transition-all`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white shadow-2xs border border-stone-200 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-stone-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">{tier.name}</span>
                          <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-600">
                            {tier.tag}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 mt-0.5">{tier.role}</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end text-xs">
                      <span className="font-mono text-stone-800 font-medium">{tier.tech}</span>
                      <span className="font-mono text-[11px] text-stone-500">
                        {tier.files.join(' · ')}
                      </span>
                    </div>
                  </div>
                </div>

                {idx < tiers.length - 1 && (
                  <div className="flex justify-center my-1">
                    <div className="w-0.5 h-3 bg-stone-300"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Directory Structure Breakdown */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <h2 className="text-base font-bold text-stone-900 mb-2">Project Filesystem Layout</h2>
        <p className="text-xs text-stone-500 mb-4">
          Modular directory tree configured for incremental feature addition across future phases.
        </p>

        <div className="font-mono text-xs bg-stone-950 text-stone-200 p-4 rounded-lg overflow-x-auto leading-relaxed border border-stone-800">
          <div className="text-emerald-400 font-bold">grocery-store-pos/</div>
          <div className="pl-4 text-stone-400">├── docker-compose.yml <span className="text-stone-500"># PostgreSQL 15, Spring Boot, Frontend stack</span></div>
          <div className="pl-4 text-stone-400">├── server.ts <span className="text-stone-500"># Full-stack Node/Express dev server + Vite middleware</span></div>
          <div className="pl-4 text-stone-400">├── package.json <span className="text-stone-500"># Frontend dependencies & build scripts</span></div>
          <div className="pl-4 text-stone-400">├── README.md <span className="text-stone-500"># Step-by-step setup documentation</span></div>
          <div className="pl-4 text-emerald-400">├── backend/ <span className="text-stone-500"># Spring Boot Java 17 Application</span></div>
          <div className="pl-8 text-stone-400">│   ├── pom.xml <span className="text-stone-500"># Maven build definition (Spring Boot 3.3.4, JPA, PostgreSQL, OpenAPI, JUnit 5)</span></div>
          <div className="pl-8 text-stone-400">│   ├── Dockerfile <span className="text-stone-500"># Multi-stage production container build</span></div>
          <div className="pl-8 text-stone-400">│   ├── src/main/java/com/grocerypos/</div>
          <div className="pl-12 text-stone-400">│   ├── GroceryPosApplication.java <span className="text-stone-500"># Main entry point</span></div>
          <div className="pl-12 text-stone-400">│   ├── config/ <span className="text-stone-500"># CorsConfig, OpenApiConfig</span></div>
          <div className="pl-12 text-stone-400">│   ├── common/ <span className="text-stone-500"># ApiResponse&lt;T&gt;, ApiErrorResponse, GlobalExceptionHandler</span></div>
          <div className="pl-12 text-stone-400">│   ├── health/ <span className="text-stone-500"># HealthCheckController, HealthCheckService, HealthStatusDto</span></div>
          <div className="pl-12 text-stone-400">│   └── [future]/ <span className="text-stone-500"># products/, inventory/, invoices/, pos/, auth/</span></div>
          <div className="pl-8 text-stone-400">│   └── src/main/resources/</div>
          <div className="pl-12 text-stone-400">│       ├── application.yml <span className="text-stone-500"># PostgreSQL connection, JPA, OpenAPI</span></div>
          <div className="pl-12 text-stone-400">│       ├── application-dev.yml <span className="text-stone-500"># Dev profile settings</span></div>
          <div className="pl-12 text-stone-400">│       └── application-test.yml <span className="text-stone-500"># H2 in-memory test profile</span></div>
          <div className="pl-4 text-emerald-400">└── src/ <span className="text-stone-500"># React 19 + TypeScript Frontend</span></div>
          <div className="pl-8 text-stone-400">    ├── App.tsx <span className="text-stone-500"># POS Layout and navigation shell</span></div>
          <div className="pl-8 text-stone-400">    ├── api/ <span className="text-stone-500"># healthApi.ts, typed REST fetch client</span></div>
          <div className="pl-8 text-stone-400">    ├── types/ <span className="text-stone-500"># health.ts TypeScript DTOs</span></div>
          <div className="pl-8 text-stone-400">    └── components/ <span className="text-stone-500"># Header, Sidebar, HealthDashboard, ArchitectureView, etc.</span></div>
        </div>
      </div>
    </div>
  );
};
