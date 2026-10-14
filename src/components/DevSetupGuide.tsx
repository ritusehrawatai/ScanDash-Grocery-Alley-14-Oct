import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink, Database, Server, Play, Shield } from 'lucide-react';

export const DevSetupGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: 'Prerequisites & Free Tooling',
      desc: 'All tools are 100% free and open source. No paid APIs or subscriptions required.',
      commands: `# Check required runtimes
java -version       # Java 17 or higher
mvn -version        # Apache Maven 3.8+
docker --version    # Docker & Docker Compose (optional but recommended)
node -v             # Node.js 18+ (for frontend)
psql --version      # PostgreSQL 15+`,
    },
    {
      title: 'Option A: One-Command Startup (Docker Compose)',
      desc: 'Spins up PostgreSQL 15, Spring Boot backend, and React frontend automatically.',
      commands: `# Start entire infrastructure: DB + Backend + Frontend
docker-compose up -d

# Verify all containers are healthy
docker-compose ps

# Follow backend logs
docker-compose logs -f backend`,
    },
    {
      title: 'Option B: Run Spring Boot Backend with Maven Locally',
      desc: 'Run PostgreSQL locally (or via Docker) and launch Spring Boot via Maven.',
      commands: `# 1. Start PostgreSQL with Docker (if not running natively)
docker run -d --name pg-pos -p 5432:5432 \\
  -e POSTGRES_DB=grocerypos \\
  -e POSTGRES_USER=postgres \\
  -e POSTGRES_PASSWORD=postgres \\
  postgres:15-alpine

# 2. Navigate to backend directory and run Spring Boot
cd backend
mvn clean spring-boot:run

# 3. Backend will start on port 8080 with:
# - Health API: http://localhost:8080/api/v1/health
# - Swagger UI: http://localhost:8080/swagger-ui.html`,
    },
    {
      title: 'Option C: Run Unit & Integration Tests (JUnit 5 + Mockito)',
      desc: 'Execute automated test suite using the H2 in-memory test profile.',
      commands: `cd backend
# Runs JUnit 5 & Mockito test suite
mvn test

# Run specific health check test
mvn test -Dtest=HealthCheckControllerTest`,
    },
    {
      title: 'Run React Frontend Locally',
      desc: 'Run the frontend dev server pointing to the Spring Boot REST API.',
      commands: `# In root directory:
npm install

# Optional: target local Spring Boot backend (defaults to /api proxy)
export VITE_API_BASE_URL="http://localhost:8080"

# Start Vite dev server on port 3000
npm run dev`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <h1 className="text-xl font-bold text-stone-900">Local Development & Architecture Setup</h1>
        <p className="text-sm text-stone-600 mt-1 max-w-3xl">
          Complete guide to running the Spring Boot backend, PostgreSQL database, and React frontend in your local environment.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded font-mono">Backend: port 8080</span>
          <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded font-mono">Frontend: port 3000</span>
          <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded font-mono">PostgreSQL: port 5432</span>
          <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded font-mono">Database: grocerypos</span>
        </div>
      </div>

      {/* Step by step cards */}
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div key={idx} className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <span>{step.title}</span>
                </h2>
                <p className="text-xs text-stone-500 mt-1 ml-7">{step.desc}</p>
              </div>

              <button
                onClick={() => copyCode(step.commands, idx)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors cursor-pointer shrink-0"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Commands</span>
                  </>
                )}
              </button>
            </div>

            <div className="ml-7 mt-3">
              <pre className="p-3 bg-stone-900 text-emerald-400 font-mono text-xs rounded-md overflow-x-auto border border-stone-800 leading-relaxed">
                {step.commands}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
